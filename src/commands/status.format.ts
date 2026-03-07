import { formatDurationPrecise } from "../infra/format-time/format-duration.ts";
import { formatRuntimeStatusWithDetails } from "../infra/runtime-status.ts";
import { t } from "../i18n/index.js";
import type { SessionStatus } from "./status.types.js";
export { shortenText } from "./text-format.js";

export const formatKTokens = (value: number) =>
  `${(value / 1000).toFixed(value >= 10_000 ? 0 : 1)}k`;

export const formatDuration = (ms: number | null | undefined) => {
  if (ms == null || !Number.isFinite(ms)) {
    return t("commands.statusFormat.unknown");
  }
  return formatDurationPrecise(ms, { decimals: 1 });
};

export const formatTokensCompact = (
  sess: Pick<
    SessionStatus,
    "totalTokens" | "contextTokens" | "percentUsed" | "cacheRead" | "cacheWrite"
  >,
) => {
  const used = sess.totalTokens;
  const ctx = sess.contextTokens;
  const cacheRead = sess.cacheRead;
  const cacheWrite = sess.cacheWrite;

  let result = "";
  if (used == null) {
    result = ctx ? `${t("commands.statusFormat.unknown")}/${formatKTokens(ctx)} (?%)` : t("commands.statusFormat.unknownUsed");
  } else if (!ctx) {
    result = `${formatKTokens(used)} ${t("commands.statusFormat.used")}`;
  } else {
    const pctLabel = sess.percentUsed != null ? `${sess.percentUsed}%` : "?%";
    result = `${formatKTokens(used)}/${formatKTokens(ctx)} (${pctLabel})`;
  }

  // Add cache hit rate if there are cached reads
  if (typeof cacheRead === "number" && cacheRead > 0) {
    const total =
      typeof used === "number"
        ? used
        : cacheRead + (typeof cacheWrite === "number" ? cacheWrite : 0);
    const hitRate = Math.round((cacheRead / total) * 100);
    result += ` · 🗄️ ${hitRate}% ${t("commands.statusFormat.cached")}`;
  }

  return result;
};

export const formatDaemonRuntimeShort = (runtime?: {
  status?: string;
  pid?: number;
  state?: string;
  detail?: string;
  missingUnit?: boolean;
}) => {
  if (!runtime) {
    return null;
  }
  const details: string[] = [];
  const detail = runtime.detail?.replace(/\s+/g, " ").trim() || "";
  const noisyLaunchctlDetail =
    runtime.missingUnit === true && detail.toLowerCase().includes("could not find service");
  if (detail && !noisyLaunchctlDetail) {
    details.push(detail);
  }
  return formatRuntimeStatusWithDetails({
    status: runtime.status,
    pid: runtime.pid,
    state: runtime.state,
    details,
  });
};
