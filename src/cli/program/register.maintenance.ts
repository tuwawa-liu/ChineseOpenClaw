import type { Command } from "commander";
import { dashboardCommand } from "../../commands/dashboard.js";
import { doctorCommand } from "../../commands/doctor.js";
import { resetCommand } from "../../commands/reset.js";
import { uninstallCommand } from "../../commands/uninstall.js";
import { t } from "../../i18n/index.js";
import { defaultRuntime } from "../../runtime.js";
import { formatDocsLink } from "../../terminal/links.js";
import { theme } from "../../terminal/theme.js";
import { runCommandWithRuntime } from "../cli-utils.js";

export function registerMaintenanceCommands(program: Command) {
  program
    .command("doctor")
    .description(t("cli.doctor.desc"))
    .addHelpText(
      "after",
      () =>
        `\n${theme.muted(t("helpDocs"))} ${formatDocsLink("/cli/doctor", "docs.openclaw.ai/cli/doctor")}\n`,
    )
    .option("--no-workspace-suggestions", t("cli.doctor.optNoWorkspaceSuggestions"), false)
    .option("--yes", t("cli.doctor.optYes"), false)
    .option("--repair", t("cli.doctor.optRepair"), false)
    .option("--fix", t("cli.doctor.optFix"), false)
    .option("--force", t("cli.doctor.optForce"), false)
    .option("--non-interactive", t("cli.doctor.optNonInteractive"), false)
    .option("--generate-gateway-token", t("cli.doctor.optGenerateGatewayToken"), false)
    .option("--deep", t("cli.doctor.optDeep"), false)
    .action(async (opts) => {
      await runCommandWithRuntime(defaultRuntime, async () => {
        await doctorCommand(defaultRuntime, {
          workspaceSuggestions: opts.workspaceSuggestions,
          yes: Boolean(opts.yes),
          repair: Boolean(opts.repair) || Boolean(opts.fix),
          force: Boolean(opts.force),
          nonInteractive: Boolean(opts.nonInteractive),
          generateGatewayToken: Boolean(opts.generateGatewayToken),
          deep: Boolean(opts.deep),
        });
        defaultRuntime.exit(0);
      });
    });

  program
    .command("dashboard")
    .description(t("cli.dashboard.desc"))
    .addHelpText(
      "after",
      () =>
        `\n${theme.muted(t("helpDocs"))} ${formatDocsLink("/cli/dashboard", "docs.openclaw.ai/cli/dashboard")}\n`,
    )
    .option("--no-open", t("cli.dashboard.optNoOpen"))
    .action(async (opts) => {
      await runCommandWithRuntime(defaultRuntime, async () => {
        await dashboardCommand(defaultRuntime, {
          noOpen: opts.open === false,
        });
      });
    });

  program
    .command("reset")
    .description(t("cli.reset.desc"))
    .addHelpText(
      "after",
      () =>
        `\n${theme.muted(t("helpDocs"))} ${formatDocsLink("/cli/reset", "docs.openclaw.ai/cli/reset")}\n`,
    )
    .option("--scope <scope>", t("cli.reset.optScope"))
    .option("--yes", t("cli.reset.optYes"), false)
    .option("--non-interactive", t("cli.reset.optNonInteractive"), false)
    .option("--dry-run", t("cli.reset.optDryRun"), false)
    .action(async (opts) => {
      await runCommandWithRuntime(defaultRuntime, async () => {
        await resetCommand(defaultRuntime, {
          scope: opts.scope,
          yes: Boolean(opts.yes),
          nonInteractive: Boolean(opts.nonInteractive),
          dryRun: Boolean(opts.dryRun),
        });
      });
    });

  program
    .command("uninstall")
    .description(t("cli.uninstall.desc"))
    .addHelpText(
      "after",
      () =>
        `\n${theme.muted(t("helpDocs"))} ${formatDocsLink("/cli/uninstall", "docs.openclaw.ai/cli/uninstall")}\n`,
    )
    .option("--service", t("cli.uninstall.optService"), false)
    .option("--state", t("cli.uninstall.optState"), false)
    .option("--workspace", t("cli.uninstall.optWorkspace"), false)
    .option("--app", t("cli.uninstall.optApp"), false)
    .option("--all", t("cli.uninstall.optAll"), false)
    .option("--yes", t("cli.uninstall.optYes"), false)
    .option("--non-interactive", t("cli.uninstall.optNonInteractive"), false)
    .option("--dry-run", t("cli.uninstall.optDryRun"), false)
    .action(async (opts) => {
      await runCommandWithRuntime(defaultRuntime, async () => {
        await uninstallCommand(defaultRuntime, {
          service: Boolean(opts.service),
          state: Boolean(opts.state),
          workspace: Boolean(opts.workspace),
          app: Boolean(opts.app),
          all: Boolean(opts.all),
          yes: Boolean(opts.yes),
          nonInteractive: Boolean(opts.nonInteractive),
          dryRun: Boolean(opts.dryRun),
        });
      });
    });
}
