import { formatCliCommand } from "../cli/command-format.js";
import type { OpenClawConfig } from "../config/config.js";
import { normalizeStoredCronJobs } from "../cron/store-migration.js";
import { resolveCronStorePath, loadCronStore, saveCronStore } from "../cron/store.js";
import type { CronJob } from "../cron/types.js";
import { note } from "../terminal/note.js";
import { shortenHomePath } from "../utils.js";
import type { DoctorPrompter, DoctorOptions } from "./doctor-prompter.js";

type CronDoctorOutcome = {
  changed: boolean;
  warnings: string[];
};

function pluralize(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function formatLegacyIssuePreview(issues: Partial<Record<string, number>>): string[] {
  const lines: string[] = [];
  if (issues.jobId) {
    lines.push(`- ${pluralize(issues.jobId, "个任务")} 仍使用旧版 \`jobId\``);
  }
  if (issues.legacyScheduleString) {
    lines.push(
      `- ${pluralize(issues.legacyScheduleString, "个任务")} 以纯字符串形式存储计划`,
    );
  }
  if (issues.legacyScheduleCron) {
    lines.push(`- ${pluralize(issues.legacyScheduleCron, "个任务")} 仍使用 \`schedule.cron\``);
  }
  if (issues.legacyPayloadKind) {
    lines.push(`- ${pluralize(issues.legacyPayloadKind, "个任务")} 需要负载类型规范化`);
  }
  if (issues.legacyPayloadProvider) {
    lines.push(
      `- ${pluralize(issues.legacyPayloadProvider, "个任务")} 仍使用负载 \`provider\` 作为投递别名`,
    );
  }
  if (issues.legacyTopLevelPayloadFields) {
    lines.push(
      `- ${pluralize(issues.legacyTopLevelPayloadFields, "个任务")} 仍使用顶层负载字段`,
    );
  }
  if (issues.legacyTopLevelDeliveryFields) {
    lines.push(
      `- ${pluralize(issues.legacyTopLevelDeliveryFields, "个任务")} 仍使用顶层投递字段`,
    );
  }
  if (issues.legacyDeliveryMode) {
    lines.push(
      `- ${pluralize(issues.legacyDeliveryMode, "个任务")} 仍使用投递模式 \`deliver\``,
    );
  }
  return lines;
}

function trimString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function migrateLegacyNotifyFallback(params: {
  jobs: Array<Record<string, unknown>>;
  legacyWebhook?: string;
}): CronDoctorOutcome {
  let changed = false;
  const warnings: string[] = [];

  for (const raw of params.jobs) {
    if (!("notify" in raw)) {
      continue;
    }

    const jobName = trimString(raw.name) ?? trimString(raw.id) ?? "<unnamed>";
    const notify = raw.notify === true;
    if (!notify) {
      delete raw.notify;
      changed = true;
      continue;
    }

    const delivery =
      raw.delivery && typeof raw.delivery === "object" && !Array.isArray(raw.delivery)
        ? (raw.delivery as Record<string, unknown>)
        : null;
    const mode = trimString(delivery?.mode)?.toLowerCase();
    const to = trimString(delivery?.to);

    if (mode === "webhook" && to) {
      delete raw.notify;
      changed = true;
      continue;
    }

    if ((mode === undefined || mode === "none" || mode === "webhook") && params.legacyWebhook) {
      raw.delivery = {
        ...delivery,
        mode: "webhook",
        to: mode === "none" ? params.legacyWebhook : (to ?? params.legacyWebhook),
      };
      delete raw.notify;
      changed = true;
      continue;
    }

    if (!params.legacyWebhook) {
      warnings.push(
        `定时任务 "${jobName}" 仍使用旧版通知回退，但 cron.webhook 未设置，因此 doctor 无法自动迁移。`,
      );
      continue;
    }

    warnings.push(
      `定时任务 "${jobName}" 在使用投递模式 "${mode}" 的同时使用了旧版通知回退。请手动迁移，以免 webhook 投递覆盖现有的广播行为。`,
    );
  }

  return { changed, warnings };
}

export async function maybeRepairLegacyCronStore(params: {
  cfg: OpenClawConfig;
  options: DoctorOptions;
  prompter: Pick<DoctorPrompter, "confirm">;
}) {
  const storePath = resolveCronStorePath(params.cfg.cron?.store);
  const store = await loadCronStore(storePath);
  const rawJobs = (store.jobs ?? []) as unknown as Array<Record<string, unknown>>;
  if (rawJobs.length === 0) {
    return;
  }

  const normalized = normalizeStoredCronJobs(rawJobs);
  const legacyWebhook = trimString(params.cfg.cron?.webhook);
  const notifyCount = rawJobs.filter((job) => job.notify === true).length;
  const previewLines = formatLegacyIssuePreview(normalized.issues);
  if (notifyCount > 0) {
    previewLines.push(
      `- ${pluralize(notifyCount, "个任务")} 仍使用旧版 \`notify: true\` webhook 回退`,
    );
  }
  if (previewLines.length === 0) {
    return;
  }

  note(
    [
      `在 ${shortenHomePath(storePath)} 检测到旧版定时任务存储。`,
      ...previewLines,
      `使用 ${formatCliCommand("openclaw doctor --fix")} 修复，以在下次调度器运行前规范化存储。`,
    ].join("\n"),
    "定时任务",
  );

  const shouldRepair = await params.prompter.confirm({
    message: "现在修复旧版定时任务？",
    initialValue: true,
  });
  if (!shouldRepair) {
    return;
  }

  const notifyMigration = migrateLegacyNotifyFallback({
    jobs: rawJobs,
    legacyWebhook,
  });
  const changed = normalized.mutated || notifyMigration.changed;
  if (!changed && notifyMigration.warnings.length === 0) {
    return;
  }

  if (changed) {
    await saveCronStore(storePath, {
      version: 1,
      jobs: rawJobs as unknown as CronJob[],
    });
    note(`定时任务存储已在 ${shortenHomePath(storePath)} 规范化。`, "诊断更改");
  }

  if (notifyMigration.warnings.length > 0) {
    note(notifyMigration.warnings.join("\n"), "诊断警告");
  }
}
