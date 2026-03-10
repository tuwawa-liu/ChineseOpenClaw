import type { Command } from "commander";
import { healthCommand } from "../../commands/health.js";
import { sessionsCleanupCommand } from "../../commands/sessions-cleanup.js";
import { sessionsCommand } from "../../commands/sessions.js";
import { statusCommand } from "../../commands/status.js";
import { setVerbose } from "../../globals.js";
import { t } from "../../i18n/index.js";
import { defaultRuntime } from "../../runtime.js";
import { formatDocsLink } from "../../terminal/links.js";
import { theme } from "../../terminal/theme.js";
import { runCommandWithRuntime } from "../cli-utils.js";
import { formatHelpExamples } from "../help-format.js";
import { parsePositiveIntOrUndefined } from "./helpers.js";

function resolveVerbose(opts: { verbose?: boolean; debug?: boolean }): boolean {
  return Boolean(opts.verbose || opts.debug);
}

function parseTimeoutMs(timeout: unknown): number | null | undefined {
  const parsed = parsePositiveIntOrUndefined(timeout);
  if (timeout !== undefined && parsed === undefined) {
    defaultRuntime.error(t("statusCli.timeoutMustBePositiveInt"));
    defaultRuntime.exit(1);
    return null;
  }
  return parsed;
}

async function runWithVerboseAndTimeout(
  opts: { verbose?: boolean; debug?: boolean; timeout?: unknown },
  action: (params: { verbose: boolean; timeoutMs: number | undefined }) => Promise<void>,
): Promise<void> {
  const verbose = resolveVerbose(opts);
  setVerbose(verbose);
  const timeoutMs = parseTimeoutMs(opts.timeout);
  if (timeoutMs === null) {
    return;
  }
  await runCommandWithRuntime(defaultRuntime, async () => {
    await action({ verbose, timeoutMs });
  });
}

export function registerStatusHealthSessionsCommands(program: Command) {
  program
    .command("status")
    .description(t("statusCli.statusDesc"))
    .option("--json", t("statusCli.jsonOpt"), false)
    .option("--all", t("statusCli.allOpt"), false)
    .option("--usage", t("statusCli.usageOpt"), false)
    .option("--deep", t("statusCli.deepOpt"), false)
    .option("--timeout <ms>", t("statusCli.timeoutOpt"), "10000")
    .option("--verbose", t("statusCli.verboseOpt"), false)
    .option("--debug", t("statusCli.debugOpt"), false)
    .addHelpText(
      "after",
      () =>
        `\n${theme.heading(t("statusCli.examplesHeading"))}\n${formatHelpExamples([
          ["openclaw status", t("statusCli.exStatusBasic")],
          ["openclaw status --all", t("statusCli.exStatusAll")],
          ["openclaw status --json", t("statusCli.exStatusJson")],
          ["openclaw status --usage", t("statusCli.exStatusUsage")],
          [
            "openclaw status --deep",
            t("statusCli.exStatusDeep"),
          ],
          ["openclaw status --deep --timeout 5000", t("statusCli.exStatusTimeout")],
        ])}`,
    )
    .addHelpText(
      "after",
      () =>
        `\n${theme.muted(t("statusCli.docsLabel"))} ${formatDocsLink("/cli/status", "docs.openclaw.ai/cli/status")}\n`,
    )
    .action(async (opts) => {
      await runWithVerboseAndTimeout(opts, async ({ verbose, timeoutMs }) => {
        await statusCommand(
          {
            json: Boolean(opts.json),
            all: Boolean(opts.all),
            deep: Boolean(opts.deep),
            usage: Boolean(opts.usage),
            timeoutMs,
            verbose,
          },
          defaultRuntime,
        );
      });
    });

  program
    .command("health")
    .description(t("statusCli.healthDesc"))
    .option("--json", t("statusCli.healthJsonOpt"), false)
    .option("--timeout <ms>", t("statusCli.healthTimeoutOpt"), "10000")
    .option("--verbose", t("statusCli.healthVerboseOpt"), false)
    .option("--debug", t("statusCli.healthDebugOpt"), false)
    .addHelpText(
      "after",
      () =>
        `\n${theme.muted(t("statusCli.docsLabel"))} ${formatDocsLink("/cli/health", "docs.openclaw.ai/cli/health")}\n`,
    )
    .action(async (opts) => {
      await runWithVerboseAndTimeout(opts, async ({ verbose, timeoutMs }) => {
        await healthCommand(
          {
            json: Boolean(opts.json),
            timeoutMs,
            verbose,
          },
          defaultRuntime,
        );
      });
    });

  const sessionsCmd = program
    .command("sessions")
    .description(t("statusCli.sessionsDesc"))
    .option("--json", t("statusCli.sessionsJsonOpt"), false)
    .option("--verbose", t("statusCli.sessionsVerboseOpt"), false)
    .option("--store <path>", t("statusCli.sessionsStoreOpt"))
    .option("--agent <id>", t("statusCli.sessionsAgentOpt"))
    .option("--all-agents", t("statusCli.sessionsAllAgentsOpt"), false)
    .option("--active <minutes>", t("statusCli.sessionsActiveOpt"))
    .addHelpText(
      "after",
      () =>
        `\n${theme.heading(t("statusCli.examplesHeading"))}\n${formatHelpExamples([
          ["openclaw sessions", t("statusCli.exSessionsList")],
          ["openclaw sessions --agent work", t("statusCli.exSessionsAgent")],
          ["openclaw sessions --all-agents", t("statusCli.exSessionsAllAgents")],
          ["openclaw sessions --active 120", t("statusCli.exSessionsActive")],
          ["openclaw sessions --json", t("statusCli.exSessionsJson")],
          ["openclaw sessions --store ./tmp/sessions.json", t("statusCli.exSessionsStore")],
        ])}\n\n${theme.muted(
          t("statusCli.sessionsTokenUsageHint"),
        )}`,
    )
    .addHelpText(
      "after",
      () =>
        `\n${theme.muted(t("statusCli.docsLabel"))} ${formatDocsLink("/cli/sessions", "docs.openclaw.ai/cli/sessions")}\n`,
    )
    .action(async (opts) => {
      setVerbose(Boolean(opts.verbose));
      await sessionsCommand(
        {
          json: Boolean(opts.json),
          store: opts.store as string | undefined,
          agent: opts.agent as string | undefined,
          allAgents: Boolean(opts.allAgents),
          active: opts.active as string | undefined,
        },
        defaultRuntime,
      );
    });
  sessionsCmd.enablePositionalOptions();

  sessionsCmd
    .command("cleanup")
    .description(t("statusCli.cleanupDesc"))
    .option("--store <path>", t("statusCli.cleanupStoreOpt"))
    .option("--agent <id>", t("statusCli.cleanupAgentOpt"))
    .option("--all-agents", t("statusCli.cleanupAllAgentsOpt"), false)
    .option("--dry-run", t("statusCli.cleanupDryRunOpt"), false)
    .option("--enforce", t("statusCli.cleanupEnforceOpt"), false)
    .option("--fix-missing", t("statusCli.cleanupFixMissingOpt"), false)
    .option("--active-key <key>", t("statusCli.cleanupActiveKeyOpt"))
    .option("--json", t("statusCli.cleanupJsonOpt"), false)
    .addHelpText(
      "after",
      () =>
        `\n${theme.heading(t("statusCli.examplesHeading"))}\n${formatHelpExamples([
          ["openclaw sessions cleanup --dry-run", t("statusCli.exCleanupDryRun")],
          [
            "openclaw sessions cleanup --dry-run --fix-missing",
            t("statusCli.exCleanupFixMissing"),
          ],
          ["openclaw sessions cleanup --enforce", t("statusCli.exCleanupEnforce")],
          ["openclaw sessions cleanup --agent work --dry-run", t("statusCli.exCleanupAgent")],
          ["openclaw sessions cleanup --all-agents --dry-run", t("statusCli.exCleanupAllAgents")],
          [
            "openclaw sessions cleanup --enforce --store ./tmp/sessions.json",
            t("statusCli.exCleanupStore"),
          ],
        ])}`,
    )
    .action(async (opts, command) => {
      const parentOpts = command.parent?.opts() as
        | {
            store?: string;
            agent?: string;
            allAgents?: boolean;
            json?: boolean;
          }
        | undefined;
      await runCommandWithRuntime(defaultRuntime, async () => {
        await sessionsCleanupCommand(
          {
            store: (opts.store as string | undefined) ?? parentOpts?.store,
            agent: (opts.agent as string | undefined) ?? parentOpts?.agent,
            allAgents: Boolean(opts.allAgents || parentOpts?.allAgents),
            dryRun: Boolean(opts.dryRun),
            enforce: Boolean(opts.enforce),
            fixMissing: Boolean(opts.fixMissing),
            activeKey: opts.activeKey as string | undefined,
            json: Boolean(opts.json || parentOpts?.json),
          },
          defaultRuntime,
        );
      });
    });
}
