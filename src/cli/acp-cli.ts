import type { Command } from "commander";
import { runAcpClientInteractive } from "../acp/client.js";
import { readSecretFromFile } from "../acp/secret-file.js";
import { serveAcpGateway } from "../acp/server.js";
import { normalizeAcpProvenanceMode } from "../acp/types.js";
import { t } from "../i18n/index.js";
import { defaultRuntime } from "../runtime.js";
import { formatDocsLink } from "../terminal/links.js";
import { theme } from "../terminal/theme.js";
import { inheritOptionFromParent } from "./command-options.js";

function resolveSecretOption(params: {
  direct?: string;
  file?: string;
  directFlag: string;
  fileFlag: string;
  label: string;
}) {
  const direct = params.direct?.trim();
  const file = params.file?.trim();
  if (direct && file) {
    throw new Error(`Use either ${params.directFlag} or ${params.fileFlag} for ${params.label}.`);
  }
  if (file) {
    return readSecretFromFile(file, params.label);
  }
  return direct || undefined;
}

function warnSecretCliFlag(flag: "--token" | "--password") {
  defaultRuntime.error(t("acpCli.warnSecretFlag", { flag }));
}

export function registerAcpCli(program: Command) {
  const acp = program.command("acp").description(t("acpCli.description"));

  acp
    .option("--url <url>", t("acpCli.optUrl"))
    .option("--token <token>", t("acpCli.optToken"))
    .option("--token-file <path>", t("acpCli.optTokenFile"))
    .option("--password <password>", t("acpCli.optPassword"))
    .option("--password-file <path>", t("acpCli.optPasswordFile"))
    .option("--session <key>", t("acpCli.optSession"))
    .option("--session-label <label>", t("acpCli.optSessionLabel"))
    .option("--require-existing", t("acpCli.optRequireExisting"), false)
    .option("--reset-session", t("acpCli.optResetSession"), false)
    .option("--no-prefix-cwd", t("acpCli.optNoPrefixCwd"), false)
    .option("--provenance <mode>", t("acpCli.optProvenance"))
    .option("-v, --verbose", t("acpCli.optVerbose"), false)
    .addHelpText(
      "after",
      () => `\n${theme.muted("Docs:")} ${formatDocsLink("/cli/acp", "docs.openclaw.ai/cli/acp")}\n`,
    )
    .action(async (opts) => {
      try {
        const gatewayToken = resolveSecretOption({
          direct: opts.token as string | undefined,
          file: opts.tokenFile as string | undefined,
          directFlag: "--token",
          fileFlag: "--token-file",
          label: "Gateway token",
        });
        const gatewayPassword = resolveSecretOption({
          direct: opts.password as string | undefined,
          file: opts.passwordFile as string | undefined,
          directFlag: "--password",
          fileFlag: "--password-file",
          label: "Gateway password",
        });
        if (opts.token) {
          warnSecretCliFlag("--token");
        }
        if (opts.password) {
          warnSecretCliFlag("--password");
        }
        const provenanceMode = normalizeAcpProvenanceMode(opts.provenance as string | undefined);
        if (opts.provenance && !provenanceMode) {
          throw new Error("Invalid --provenance value. Use off, meta, or meta+receipt.");
        }
        await serveAcpGateway({
          gatewayUrl: opts.url as string | undefined,
          gatewayToken,
          gatewayPassword,
          defaultSessionKey: opts.session as string | undefined,
          defaultSessionLabel: opts.sessionLabel as string | undefined,
          requireExistingSession: Boolean(opts.requireExisting),
          resetSession: Boolean(opts.resetSession),
          prefixCwd: !opts.noPrefixCwd,
          provenanceMode,
          verbose: Boolean(opts.verbose),
        });
      } catch (err) {
        defaultRuntime.error(String(err));
        defaultRuntime.exit(1);
      }
    });

  acp
    .command("client")
    .description(t("acpCli.clientDescription"))
    .option("--cwd <dir>", t("acpCli.clientOptCwd"))
    .option("--server <command>", t("acpCli.clientOptServer"))
    .option("--server-args <args...>", t("acpCli.clientOptServerArgs"))
    .option("--server-verbose", t("acpCli.clientOptServerVerbose"), false)
    .option("-v, --verbose", t("acpCli.clientOptVerbose"), false)
    .action(async (opts, command) => {
      const inheritedVerbose = inheritOptionFromParent<boolean>(command, "verbose");
      try {
        await runAcpClientInteractive({
          cwd: opts.cwd as string | undefined,
          serverCommand: opts.server as string | undefined,
          serverArgs: opts.serverArgs as string[] | undefined,
          serverVerbose: Boolean(opts.serverVerbose),
          verbose: Boolean(opts.verbose || inheritedVerbose),
        });
      } catch (err) {
        defaultRuntime.error(String(err));
        defaultRuntime.exit(1);
      }
    });
}
