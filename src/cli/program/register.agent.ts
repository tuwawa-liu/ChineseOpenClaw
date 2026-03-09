import type { Command } from "commander";
import { agentCliCommand } from "../../commands/agent-via-gateway.js";
import {
  agentsAddCommand,
  agentsBindingsCommand,
  agentsBindCommand,
  agentsDeleteCommand,
  agentsListCommand,
  agentsSetIdentityCommand,
  agentsUnbindCommand,
} from "../../commands/agents.js";
import { setVerbose } from "../../globals.js";
import { t } from "../../i18n/index.js";
import { defaultRuntime } from "../../runtime.js";
import { formatDocsLink } from "../../terminal/links.js";
import { theme } from "../../terminal/theme.js";
import { runCommandWithRuntime } from "../cli-utils.js";
import { hasExplicitOptions } from "../command-options.js";
import { createDefaultDeps } from "../deps.js";
import { formatHelpExamples } from "../help-format.js";
import { collectOption } from "./helpers.js";

export function registerAgentCommands(program: Command, args: { agentChannelOptions: string }) {
  program
    .command("agent")
    .description(t("agentCli.agentDesc"))
    .requiredOption("-m, --message <text>", t("agentCli.messageOpt"))
    .option("-t, --to <number>", t("agentCli.toOpt"))
    .option("--session-id <id>", t("agentCli.sessionIdOpt"))
    .option("--agent <id>", t("agentCli.agentIdOpt"))
    .option("--thinking <level>", t("agentCli.thinkingOpt"))
    .option("--verbose <on|off>", t("agentCli.verboseOpt"))
    .option("--channel <channel>", t("agentCli.channelOpt", { channels: args.agentChannelOptions }))
    .option("--reply-to <target>", t("agentCli.replyToOpt"))
    .option("--reply-channel <channel>", t("agentCli.replyChannelOpt"))
    .option("--reply-account <id>", t("agentCli.replyAccountOpt"))
    .option("--local", t("agentCli.localOpt"), false)
    .option("--deliver", t("agentCli.deliverOpt"), false)
    .option("--json", t("agentCli.jsonOpt"), false)
    .option("--timeout <seconds>", t("agentCli.timeoutOpt"))
    .addHelpText(
      "after",
      () =>
        `
${theme.heading("Examples:")}
${formatHelpExamples([
  ['openclaw agent --to +15555550123 --message "status update"', "Start a new session."],
  ['openclaw agent --agent ops --message "Summarize logs"', "Use a specific agent."],
  [
    'openclaw agent --session-id 1234 --message "Summarize inbox" --thinking medium',
    "Target a session with explicit thinking level.",
  ],
  [
    'openclaw agent --to +15555550123 --message "Trace logs" --verbose on --json',
    "Enable verbose logging and JSON output.",
  ],
  ['openclaw agent --to +15555550123 --message "Summon reply" --deliver', "Deliver reply."],
  [
    'openclaw agent --agent ops --message "Generate report" --deliver --reply-channel slack --reply-to "#reports"',
    "Send reply to a different channel/target.",
  ],
])}

${theme.muted("Docs:")} ${formatDocsLink("/cli/agent", "docs.openclaw.ai/cli/agent")}`,
    )
    .action(async (opts) => {
      const verboseLevel = typeof opts.verbose === "string" ? opts.verbose.toLowerCase() : "";
      setVerbose(verboseLevel === "on");
      // Build default deps (keeps parity with other commands; future-proofing).
      const deps = createDefaultDeps();
      await runCommandWithRuntime(defaultRuntime, async () => {
        await agentCliCommand(opts, defaultRuntime, deps);
      });
    });

  const agents = program
    .command("agents")
    .description(t("agentCli.agentsDesc"))
    .addHelpText(
      "after",
      () =>
        `\n${theme.muted("Docs:")} ${formatDocsLink("/cli/agents", "docs.openclaw.ai/cli/agents")}\n`,
    );

  agents
    .command("list")
    .description(t("agentCli.listDesc"))
    .option("--json", t("agentCli.listJsonOpt"), false)
    .option("--bindings", t("agentCli.listBindingsOpt"), false)
    .action(async (opts) => {
      await runCommandWithRuntime(defaultRuntime, async () => {
        await agentsListCommand(
          { json: Boolean(opts.json), bindings: Boolean(opts.bindings) },
          defaultRuntime,
        );
      });
    });

  agents
    .command("bindings")
    .description(t("agentCli.bindingsDesc"))
    .option("--agent <id>", t("agentCli.bindingsAgentOpt"))
    .option("--json", t("agentCli.bindingsJsonOpt"), false)
    .action(async (opts) => {
      await runCommandWithRuntime(defaultRuntime, async () => {
        await agentsBindingsCommand(
          {
            agent: opts.agent as string | undefined,
            json: Boolean(opts.json),
          },
          defaultRuntime,
        );
      });
    });

  agents
    .command("bind")
    .description(t("agentCli.bindDesc"))
    .option("--agent <id>", t("agentCli.bindAgentOpt"))
    .option("--bind <channel[:accountId]>", t("agentCli.bindBindOpt"), collectOption, [])
    .option("--json", t("agentCli.bindJsonOpt"), false)
    .action(async (opts) => {
      await runCommandWithRuntime(defaultRuntime, async () => {
        await agentsBindCommand(
          {
            agent: opts.agent as string | undefined,
            bind: Array.isArray(opts.bind) ? (opts.bind as string[]) : undefined,
            json: Boolean(opts.json),
          },
          defaultRuntime,
        );
      });
    });

  agents
    .command("unbind")
    .description(t("agentCli.unbindDesc"))
    .option("--agent <id>", t("agentCli.unbindAgentOpt"))
    .option("--bind <channel[:accountId]>", t("agentCli.unbindBindOpt"), collectOption, [])
    .option("--all", t("agentCli.unbindAllOpt"), false)
    .option("--json", t("agentCli.unbindJsonOpt"), false)
    .action(async (opts) => {
      await runCommandWithRuntime(defaultRuntime, async () => {
        await agentsUnbindCommand(
          {
            agent: opts.agent as string | undefined,
            bind: Array.isArray(opts.bind) ? (opts.bind as string[]) : undefined,
            all: Boolean(opts.all),
            json: Boolean(opts.json),
          },
          defaultRuntime,
        );
      });
    });

  agents
    .command("add [name]")
    .description(t("agentCli.addDesc"))
    .option("--workspace <dir>", t("agentCli.addWorkspaceOpt"))
    .option("--model <id>", t("agentCli.addModelOpt"))
    .option("--agent-dir <dir>", t("agentCli.addAgentDirOpt"))
    .option("--bind <channel[:accountId]>", t("agentCli.addBindOpt"), collectOption, [])
    .option("--non-interactive", t("agentCli.addNonInteractiveOpt"), false)
    .option("--json", t("agentCli.addJsonOpt"), false)
    .action(async (name, opts, command) => {
      await runCommandWithRuntime(defaultRuntime, async () => {
        const hasFlags = hasExplicitOptions(command, [
          "workspace",
          "model",
          "agentDir",
          "bind",
          "nonInteractive",
        ]);
        await agentsAddCommand(
          {
            name: typeof name === "string" ? name : undefined,
            workspace: opts.workspace as string | undefined,
            model: opts.model as string | undefined,
            agentDir: opts.agentDir as string | undefined,
            bind: Array.isArray(opts.bind) ? (opts.bind as string[]) : undefined,
            nonInteractive: Boolean(opts.nonInteractive),
            json: Boolean(opts.json),
          },
          defaultRuntime,
          { hasFlags },
        );
      });
    });

  agents
    .command("set-identity")
    .description(t("agentCli.setIdentityDesc"))
    .option("--agent <id>", t("agentCli.setIdentityAgentOpt"))
    .option("--workspace <dir>", t("agentCli.setIdentityWorkspaceOpt"))
    .option("--identity-file <path>", t("agentCli.setIdentityFileOpt"))
    .option("--from-identity", t("agentCli.setIdentityFromOpt"), false)
    .option("--name <name>", t("agentCli.setIdentityNameOpt"))
    .option("--theme <theme>", t("agentCli.setIdentityThemeOpt"))
    .option("--emoji <emoji>", t("agentCli.setIdentityEmojiOpt"))
    .option("--avatar <value>", t("agentCli.setIdentityAvatarOpt"))
    .option("--json", t("agentCli.setIdentityJsonOpt"), false)
    .addHelpText(
      "after",
      () =>
        `
${theme.heading("Examples:")}
${formatHelpExamples([
  ['openclaw agents set-identity --agent main --name "OpenClaw" --emoji "🦞"', "Set name + emoji."],
  ["openclaw agents set-identity --agent main --avatar avatars/openclaw.png", "Set avatar path."],
  [
    "openclaw agents set-identity --workspace ~/.openclaw/workspace --from-identity",
    "Load from IDENTITY.md.",
  ],
  [
    "openclaw agents set-identity --identity-file ~/.openclaw/workspace/IDENTITY.md --agent main",
    "Use a specific IDENTITY.md.",
  ],
])}
`,
    )
    .action(async (opts) => {
      await runCommandWithRuntime(defaultRuntime, async () => {
        await agentsSetIdentityCommand(
          {
            agent: opts.agent as string | undefined,
            workspace: opts.workspace as string | undefined,
            identityFile: opts.identityFile as string | undefined,
            fromIdentity: Boolean(opts.fromIdentity),
            name: opts.name as string | undefined,
            theme: opts.theme as string | undefined,
            emoji: opts.emoji as string | undefined,
            avatar: opts.avatar as string | undefined,
            json: Boolean(opts.json),
          },
          defaultRuntime,
        );
      });
    });

  agents
    .command("delete <id>")
    .description(t("agentCli.deleteDesc"))
    .option("--force", t("agentCli.deleteForceOpt"), false)
    .option("--json", t("agentCli.deleteJsonOpt"), false)
    .action(async (id, opts) => {
      await runCommandWithRuntime(defaultRuntime, async () => {
        await agentsDeleteCommand(
          {
            id: String(id),
            force: Boolean(opts.force),
            json: Boolean(opts.json),
          },
          defaultRuntime,
        );
      });
    });

  agents.action(async () => {
    await runCommandWithRuntime(defaultRuntime, async () => {
      await agentsListCommand({}, defaultRuntime);
    });
  });
}
