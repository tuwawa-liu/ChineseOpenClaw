import { t } from "../../i18n/index.js";
import type { ProgressReporter } from "../../cli/progress.js";
import { getTerminalTableWidth, renderTable } from "../../terminal/table.js";
import { isRich, theme } from "../../terminal/theme.js";
import { groupChannelIssuesByChannel } from "./channel-issues.js";
import { appendStatusAllDiagnosis } from "./diagnosis.js";
import { formatTimeAgo } from "./format.js";

type OverviewRow = { Item: string; Value: string };

type ChannelsTable = {
  rows: Array<{
    id: string;
    label: string;
    enabled: boolean;
    state: "ok" | "warn" | "off" | "setup";
    detail: string;
  }>;
  details: Array<{
    title: string;
    columns: string[];
    rows: Array<Record<string, string>>;
  }>;
};

type ChannelIssueLike = {
  channel: string;
  message: string;
};

type AgentStatusLike = {
  agents: Array<{
    id: string;
    name?: string | null;
    bootstrapPending?: boolean | null;
    sessionsCount: number;
    lastActiveAgeMs?: number | null;
    sessionsPath: string;
  }>;
};

export async function buildStatusAllReportLines(params: {
  progress: ProgressReporter;
  overviewRows: OverviewRow[];
  channels: ChannelsTable;
  channelIssues: ChannelIssueLike[];
  agentStatus: AgentStatusLike;
  connectionDetailsForReport: string;
  diagnosis: Omit<
    Parameters<typeof appendStatusAllDiagnosis>[0],
    "lines" | "progress" | "muted" | "ok" | "warn" | "fail" | "connectionDetailsForReport"
  >;
}) {
  const rich = isRich();
  const heading = (text: string) => (rich ? theme.heading(text) : text);
  const ok = (text: string) => (rich ? theme.success(text) : text);
  const warn = (text: string) => (rich ? theme.warn(text) : text);
  const fail = (text: string) => (rich ? theme.error(text) : text);
  const muted = (text: string) => (rich ? theme.muted(text) : text);

  const tableWidth = getTerminalTableWidth();

  const overview = renderTable({
    width: tableWidth,
    columns: [
      { key: "Item", header: t("statusAllReportLines.itemHeader"), minWidth: 10 },
      { key: "Value", header: t("statusAllReportLines.valueHeader"), flex: true, minWidth: 24 },
    ],
    rows: params.overviewRows,
  });

  const channelRows = params.channels.rows.map((row) => ({
    channelId: row.id,
    Channel: row.label,
    Enabled: row.enabled ? ok(t("statusAllReportLines.statusOn")) : muted(t("statusAllReportLines.statusOff")),
    State:
      row.state === "ok"
        ? ok(t("statusAllReportLines.statusOk"))
        : row.state === "warn"
          ? warn(t("statusAllReportLines.statusWarn"))
          : row.state === "off"
            ? muted(t("statusAllReportLines.statusOff"))
            : theme.accentDim(t("statusAllReportLines.statusSetup")),
    Detail: row.detail,
  }));
  const channelIssuesByChannel = groupChannelIssuesByChannel(params.channelIssues);
  const channelRowsWithIssues = channelRows.map((row) => {
    const issues = channelIssuesByChannel.get(row.channelId) ?? [];
    if (issues.length === 0) {
      return row;
    }
    const issue = issues[0];
    const suffix = ` · ${warn(t("statusAllReportLines.gatewayIssue", { message: String(issue.message).slice(0, 90) }))}`;
    return {
      ...row,
      State: warn(t("statusAllReportLines.statusWarn")),
      Detail: `${row.Detail}${suffix}`,
    };
  });

  const channelsTable = renderTable({
    width: tableWidth,
    columns: [
      { key: "Channel", header: t("statusAllReportLines.channelHeader"), minWidth: 10 },
      { key: "Enabled", header: t("statusAllReportLines.enabledHeader"), minWidth: 7 },
      { key: "State", header: t("statusAllReportLines.stateHeader"), minWidth: 8 },
      { key: "Detail", header: t("statusAllReportLines.detailHeader"), flex: true, minWidth: 28 },
    ],
    rows: channelRowsWithIssues,
  });

  const agentRows = params.agentStatus.agents.map((a) => ({
    Agent: a.name?.trim() ? `${a.id} (${a.name.trim()})` : a.id,
    BootstrapFile:
      a.bootstrapPending === true
        ? warn(t("statusAllReportLines.statusPresent"))
        : a.bootstrapPending === false
          ? ok(t("statusAllReportLines.statusAbsent"))
          : t("statusAllReportLines.unknown"),
    Sessions: String(a.sessionsCount),
    Active: a.lastActiveAgeMs != null ? formatTimeAgo(a.lastActiveAgeMs) : t("statusAllReportLines.unknown"),
    Store: a.sessionsPath,
  }));

  const agentsTable = renderTable({
    width: tableWidth,
    columns: [
      { key: "Agent", header: t("statusAllReportLines.agentHeader"), minWidth: 12 },
      { key: "BootstrapFile", header: t("statusAllReportLines.bootstrapFileHeader"), minWidth: 14 },
      { key: "Sessions", header: t("statusAllReportLines.sessionsHeader"), align: "right", minWidth: 8 },
      { key: "Active", header: t("statusAllReportLines.activeHeader"), minWidth: 10 },
      { key: "Store", header: t("statusAllReportLines.storeHeader"), flex: true, minWidth: 34 },
    ],
    rows: agentRows,
  });

  const lines: string[] = [];
  lines.push(heading(t("statusAllReportLines.title")));
  lines.push("");
  lines.push(heading(t("statusAllReportLines.overview")));
  lines.push(overview.trimEnd());
  lines.push("");
  lines.push(heading(t("statusAllReportLines.channels")));
  lines.push(channelsTable.trimEnd());
  for (const detail of params.channels.details) {
    lines.push("");
    lines.push(heading(detail.title));
    lines.push(
      renderTable({
        width: tableWidth,
        columns: detail.columns.map((c) => ({
          key: c,
          header: c,
          flex: c === t("statusAllReportLines.notesHeader"),
          minWidth: c === t("statusAllReportLines.notesHeader") ? 28 : 10,
        })),
        rows: detail.rows.map((r) => ({
          ...r,
          ...(r.Status === "OK"
            ? { Status: ok(t("statusAllReportLines.statusOk")) }
            : r.Status === "WARN"
              ? { Status: warn(t("statusAllReportLines.statusWarn")) }
              : {}),
        })),
      }).trimEnd(),
    );
  }
  lines.push("");
  lines.push(heading(t("statusAllReportLines.agents")));
  lines.push(agentsTable.trimEnd());
  lines.push("");
  lines.push(heading(t("statusAllReportLines.diagnosis")));

  await appendStatusAllDiagnosis({
    lines,
    progress: params.progress,
    muted,
    ok,
    warn,
    fail,
    connectionDetailsForReport: params.connectionDetailsForReport,
    ...params.diagnosis,
  });

  return lines;
}
