import { formatCliCommand } from "../cli/command-format.js";
import { type OpenClawConfig, readConfigFileSnapshot } from "../config/config.js";
import { formatConfigIssueLines } from "../config/issue-format.js";
import { t } from "../i18n/index.js";
import type { RuntimeEnv } from "../runtime.js";

export async function requireValidConfigSnapshot(
  runtime: RuntimeEnv,
): Promise<OpenClawConfig | null> {
  const snapshot = await readConfigFileSnapshot();
  if (snapshot.exists && !snapshot.valid) {
    const issues =
      snapshot.issues.length > 0
        ? formatConfigIssueLines(snapshot.issues, "-").join("\n")
        : t("commands.configValidation.unknownIssue");
    runtime.error(t("commands.configValidation.configInvalid", { issues }));
    runtime.error(t("commands.configValidation.fixHint", { command: formatCliCommand("openclaw doctor") }));
    runtime.exit(1);
    return null;
  }
  return snapshot.config;
}
