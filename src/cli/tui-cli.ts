import type { Command } from "commander";
import { t } from "../i18n/index.js";
import { defaultRuntime } from "../runtime.js";
import { formatDocsLink } from "../terminal/links.js";
import { theme } from "../terminal/theme.js";
import { runTui } from "../tui/tui.js";
import { parseTimeoutMs } from "./parse-timeout.js";

export function registerTuiCli(program: Command) {
  program
    .command("tui")
    .description(t("tuiCli.description"))
    .option("--url <url>", t("tuiCli.urlOpt"))
    .option("--token <token>", t("tuiCli.tokenOpt"))
    .option("--password <password>", t("tuiCli.passwordOpt"))
    .option("--session <key>", t("tuiCli.sessionOpt"))
    .option("--deliver", t("tuiCli.deliverOpt"), false)
    .option("--thinking <level>", t("tuiCli.thinkingOpt"))
    .option("--message <text>", t("tuiCli.messageOpt"))
    .option("--timeout-ms <ms>", t("tuiCli.timeoutMsOpt"))
    .option("--history-limit <n>", t("tuiCli.historyLimitOpt"), "200")
    .addHelpText(
      "after",
      () => `\n${theme.muted("Docs:")} ${formatDocsLink("/cli/tui", "docs.openclaw.ai/cli/tui")}\n`,
    )
    .action(async (opts) => {
      try {
        const timeoutMs = parseTimeoutMs(opts.timeoutMs);
        if (opts.timeoutMs !== undefined && timeoutMs === undefined) {
          defaultRuntime.error(t("tuiCli.invalidTimeoutMs", { value: String(opts.timeoutMs) }));
        }
        const historyLimit = Number.parseInt(String(opts.historyLimit ?? "200"), 10);
        await runTui({
          url: opts.url as string | undefined,
          token: opts.token as string | undefined,
          password: opts.password as string | undefined,
          session: opts.session as string | undefined,
          deliver: Boolean(opts.deliver),
          thinking: opts.thinking as string | undefined,
          message: opts.message as string | undefined,
          timeoutMs,
          historyLimit: Number.isNaN(historyLimit) ? undefined : historyLimit,
        });
      } catch (err) {
        defaultRuntime.error(String(err));
        defaultRuntime.exit(1);
      }
    });
}
