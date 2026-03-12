import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import type { Command } from "commander";
import { resolveAgentWorkspaceDir, resolveDefaultAgentId } from "../agents/agent-scope.js";
import type { OpenClawConfig } from "../config/config.js";
import { loadConfig, writeConfigFile } from "../config/io.js";
import {
  buildWorkspaceHookStatus,
  type HookStatusEntry,
  type HookStatusReport,
} from "../hooks/hooks-status.js";
import {
  installHooksFromNpmSpec,
  installHooksFromPath,
  resolveHookInstallDir,
} from "../hooks/install.js";
import { recordHookInstall } from "../hooks/installs.js";
import type { HookEntry } from "../hooks/types.js";
import { loadWorkspaceHookEntries } from "../hooks/workspace.js";
import { t } from "../i18n/index.js";
import { resolveArchiveKind } from "../infra/archive.js";
import { buildPluginStatusReport } from "../plugins/status.js";
import { defaultRuntime } from "../runtime.js";
import { formatDocsLink } from "../terminal/links.js";
import { getTerminalTableWidth, renderTable } from "../terminal/table.js";
import { theme } from "../terminal/theme.js";
import { resolveUserPath, shortenHomePath } from "../utils.js";
import { formatCliCommand } from "./command-format.js";
import { looksLikeLocalInstallSpec } from "./install-spec.js";
import {
  buildNpmInstallRecordFields,
  resolvePinnedNpmInstallRecordForCli,
} from "./npm-resolution.js";
import { promptYesNo } from "./prompt.js";

export type HooksListOptions = {
  json?: boolean;
  eligible?: boolean;
  verbose?: boolean;
};

export type HookInfoOptions = {
  json?: boolean;
};

export type HooksCheckOptions = {
  json?: boolean;
};

export type HooksUpdateOptions = {
  all?: boolean;
  dryRun?: boolean;
};

function mergeHookEntries(pluginEntries: HookEntry[], workspaceEntries: HookEntry[]): HookEntry[] {
  const merged = new Map<string, HookEntry>();
  for (const entry of pluginEntries) {
    merged.set(entry.hook.name, entry);
  }
  for (const entry of workspaceEntries) {
    merged.set(entry.hook.name, entry);
  }
  return Array.from(merged.values());
}

function buildHooksReport(config: OpenClawConfig): HookStatusReport {
  const workspaceDir = resolveAgentWorkspaceDir(config, resolveDefaultAgentId(config));
  const workspaceEntries = loadWorkspaceHookEntries(workspaceDir, { config });
  const pluginReport = buildPluginStatusReport({ config, workspaceDir });
  const pluginEntries = pluginReport.hooks.map((hook) => hook.entry);
  const entries = mergeHookEntries(pluginEntries, workspaceEntries);
  return buildWorkspaceHookStatus(workspaceDir, { config, entries });
}

function resolveHookForToggle(
  report: HookStatusReport,
  hookName: string,
  opts?: { requireEligible?: boolean },
): HookStatusEntry {
  const hook = report.hooks.find((h) => h.name === hookName);
  if (!hook) {
    throw new Error(t("hooks.hookNotFound", { name: hookName }));
  }
  if (hook.managedByPlugin) {
    throw new Error(
      t("hooks.managedByPlugin", { name: hookName, plugin: hook.pluginId ?? "unknown" }),
    );
  }
  if (opts?.requireEligible && !hook.eligible) {
    throw new Error(t("hooks.notEligible", { name: hookName }));
  }
  return hook;
}

function buildConfigWithHookEnabled(params: {
  config: OpenClawConfig;
  hookName: string;
  enabled: boolean;
  ensureHooksEnabled?: boolean;
}): OpenClawConfig {
  const entries = { ...params.config.hooks?.internal?.entries };
  entries[params.hookName] = { ...entries[params.hookName], enabled: params.enabled };

  const internal = {
    ...params.config.hooks?.internal,
    ...(params.ensureHooksEnabled ? { enabled: true } : {}),
    entries,
  };

  return {
    ...params.config,
    hooks: {
      ...params.config.hooks,
      internal,
    },
  };
}

function formatHookStatus(hook: HookStatusEntry): string {
  if (hook.eligible) {
    return theme.success(t("hooksFormat.readyLower"));
  }
  if (hook.disabled) {
    return theme.warn(t("hooksFormat.disabledLower"));
  }
  return theme.error(t("hooksFormat.missingLower"));
}

function formatHookName(hook: HookStatusEntry): string {
  const emoji = hook.emoji ?? "🔗";
  return `${emoji} ${theme.command(hook.name)}`;
}

function formatHookSource(hook: HookStatusEntry): string {
  if (!hook.managedByPlugin) {
    return hook.source;
  }
  return `plugin:${hook.pluginId ?? "unknown"}`;
}

function formatHookMissingSummary(hook: HookStatusEntry): string {
  const missing: string[] = [];
  if (hook.missing.bins.length > 0) {
    missing.push(`bins: ${hook.missing.bins.join(", ")}`);
  }
  if (hook.missing.anyBins.length > 0) {
    missing.push(`anyBins: ${hook.missing.anyBins.join(", ")}`);
  }
  if (hook.missing.env.length > 0) {
    missing.push(`env: ${hook.missing.env.join(", ")}`);
  }
  if (hook.missing.config.length > 0) {
    missing.push(`config: ${hook.missing.config.join(", ")}`);
  }
  if (hook.missing.os.length > 0) {
    missing.push(`os: ${hook.missing.os.join(", ")}`);
  }
  return missing.join("; ");
}

function exitHooksCliWithError(err: unknown): never {
  defaultRuntime.error(
    `${theme.error("Error:")} ${err instanceof Error ? err.message : String(err)}`,
  );
  process.exit(1);
}

async function runHooksCliAction(action: () => Promise<void> | void): Promise<void> {
  try {
    await action();
  } catch (err) {
    exitHooksCliWithError(err);
  }
}

function createInstallLogger() {
  return {
    info: (msg: string) => defaultRuntime.log(msg),
    warn: (msg: string) => defaultRuntime.log(theme.warn(msg)),
  };
}

function logGatewayRestartHint() {
  defaultRuntime.log(t("hooks.restartGateway"));
}

function logIntegrityDriftWarning(
  hookId: string,
  drift: {
    resolution: { resolvedSpec?: string };
    spec: string;
    expectedIntegrity: string;
    actualIntegrity: string;
  },
) {
  const specLabel = drift.resolution.resolvedSpec ?? drift.spec;
  defaultRuntime.log(
    theme.warn(
      `Integrity drift detected for "${hookId}" (${specLabel})` +
        `\nExpected: ${drift.expectedIntegrity}` +
        `\nActual:   ${drift.actualIntegrity}`,
    ),
  );
}

async function readInstalledPackageVersion(dir: string): Promise<string | undefined> {
  try {
    const raw = await fsp.readFile(path.join(dir, "package.json"), "utf-8");
    const parsed = JSON.parse(raw) as { version?: unknown };
    return typeof parsed.version === "string" ? parsed.version : undefined;
  } catch {
    return undefined;
  }
}

type HookInternalEntryLike = Record<string, unknown> & { enabled?: boolean };

function enableInternalHookEntries(config: OpenClawConfig, hookNames: string[]): OpenClawConfig {
  const entries = { ...config.hooks?.internal?.entries } as Record<string, HookInternalEntryLike>;

  for (const hookName of hookNames) {
    entries[hookName] = {
      ...entries[hookName],
      enabled: true,
    };
  }

  return {
    ...config,
    hooks: {
      ...config.hooks,
      internal: {
        ...config.hooks?.internal,
        enabled: true,
        entries,
      },
    },
  };
}

/**
 * Format the hooks list output
 */
export function formatHooksList(report: HookStatusReport, opts: HooksListOptions): string {
  const hooks = opts.eligible ? report.hooks.filter((h) => h.eligible) : report.hooks;

  if (opts.json) {
    const jsonReport = {
      workspaceDir: report.workspaceDir,
      managedHooksDir: report.managedHooksDir,
      hooks: hooks.map((h) => ({
        name: h.name,
        description: h.description,
        emoji: h.emoji,
        eligible: h.eligible,
        disabled: h.disabled,
        source: h.source,
        pluginId: h.pluginId,
        events: h.events,
        homepage: h.homepage,
        missing: h.missing,
        managedByPlugin: h.managedByPlugin,
      })),
    };
    return JSON.stringify(jsonReport, null, 2);
  }

  if (hooks.length === 0) {
    const message = opts.eligible
      ? `No eligible hooks found. Run \`${formatCliCommand("openclaw hooks list")}\` to see all hooks.`
      : "No hooks found.";
    return message;
  }

  const eligible = hooks.filter((h) => h.eligible);
  const tableWidth = getTerminalTableWidth();
  const rows = hooks.map((hook) => {
    const missing = formatHookMissingSummary(hook);
    return {
      Status: formatHookStatus(hook),
      Hook: formatHookName(hook),
      Description: theme.muted(hook.description),
      Source: formatHookSource(hook),
      Missing: missing ? theme.warn(missing) : "",
    };
  });

  const columns = [
    { key: "Status", header: "Status", minWidth: 10 },
    { key: "Hook", header: "Hook", minWidth: 18, flex: true },
    { key: "Description", header: "Description", minWidth: 24, flex: true },
    { key: "Source", header: "Source", minWidth: 12, flex: true },
  ];
  if (opts.verbose) {
    columns.push({ key: "Missing", header: "Missing", minWidth: 18, flex: true });
  }

  const lines: string[] = [];
  lines.push(
    `${theme.heading("钩子")} ${theme.muted(`(${eligible.length}/${hooks.length} ready)`)}`,
  );
  lines.push(
    renderTable({
      width: tableWidth,
      columns,
      rows,
    }).trimEnd(),
  );
  return lines.join("\n");
}

/**
 * Format detailed info for a single hook
 */
export function formatHookInfo(
  report: HookStatusReport,
  hookName: string,
  opts: HookInfoOptions,
): string {
  const hook = report.hooks.find((h) => h.name === hookName || h.hookKey === hookName);

  if (!hook) {
    if (opts.json) {
      return JSON.stringify({ error: "not found", hook: hookName }, null, 2);
    }
    return `Hook "${hookName}" not found. Run \`${formatCliCommand("openclaw hooks list")}\` to see available hooks.`;
  }

  if (opts.json) {
    return JSON.stringify(hook, null, 2);
  }

  const lines: string[] = [];
  const emoji = hook.emoji ?? "🔗";
  const status = hook.eligible
    ? theme.success(t("hooksFormat.readyUpper"))
    : hook.disabled
      ? theme.warn(t("hooksFormat.disabledUpper"))
      : theme.error(t("hooksFormat.missingReqsUpper"));

  lines.push(`${emoji} ${theme.heading(hook.name)} ${status}`);
  lines.push("");
  lines.push(hook.description);
  lines.push("");

  // Details
  lines.push(theme.heading(t("hooksFormat.detailsHeading")));
  if (hook.managedByPlugin) {
    lines.push(`${theme.muted(t("hooksFormat.sourceLabel"))} ${hook.source} (${hook.pluginId ?? "unknown"})`);
  } else {
    lines.push(`${theme.muted(t("hooksFormat.sourceLabel"))} ${hook.source}`);
  }
  lines.push(`${theme.muted(t("hooksFormat.pathLabel"))} ${shortenHomePath(hook.filePath)}`);
  lines.push(`${theme.muted(t("hooksFormat.handlerLabel"))} ${shortenHomePath(hook.handlerPath)}`);
  if (hook.homepage) {
    lines.push(`${theme.muted(t("hooksFormat.homepageLabel"))} ${hook.homepage}`);
  }
  if (hook.events.length > 0) {
    lines.push(`${theme.muted(t("hooksFormat.eventsLabel"))} ${hook.events.join(", ")}`);
  }
  if (hook.managedByPlugin) {
    lines.push(theme.muted(t("hooksFormat.managedByPlugin")));
  }

  // Requirements
  const hasRequirements =
    hook.requirements.bins.length > 0 ||
    hook.requirements.anyBins.length > 0 ||
    hook.requirements.env.length > 0 ||
    hook.requirements.config.length > 0 ||
    hook.requirements.os.length > 0;

  if (hasRequirements) {
    lines.push("");
    lines.push(theme.heading(t("hooksFormat.requirementsHeading")));
    if (hook.requirements.bins.length > 0) {
      const binsStatus = hook.requirements.bins.map((bin) => {
        const missing = hook.missing.bins.includes(bin);
        return missing ? theme.error(`✗ ${bin}`) : theme.success(`✓ ${bin}`);
      });
      lines.push(`${theme.muted(t("hooksFormat.binariesLabel"))} ${binsStatus.join(", ")}`);
    }
    if (hook.requirements.anyBins.length > 0) {
      const anyBinsStatus =
        hook.missing.anyBins.length > 0
          ? theme.error(`✗ (任一: ${hook.requirements.anyBins.join(", ")})`)
          : theme.success(`✓ (任一: ${hook.requirements.anyBins.join(", ")})`);
      lines.push(`${theme.muted(t("hooksFormat.anyBinaryLabel"))} ${anyBinsStatus}`);
    }
    if (hook.requirements.env.length > 0) {
      const envStatus = hook.requirements.env.map((env) => {
        const missing = hook.missing.env.includes(env);
        return missing ? theme.error(`✗ ${env}`) : theme.success(`✓ ${env}`);
      });
      lines.push(`${theme.muted(t("hooksFormat.environmentLabel"))} ${envStatus.join(", ")}`);
    }
    if (hook.requirements.config.length > 0) {
      const configStatus = hook.configChecks.map((check) => {
        return check.satisfied ? theme.success(`✓ ${check.path}`) : theme.error(`✗ ${check.path}`);
      });
      lines.push(`${theme.muted(t("hooksFormat.configLabel"))} ${configStatus.join(", ")}`);
    }
    if (hook.requirements.os.length > 0) {
      const osStatus =
        hook.missing.os.length > 0
          ? theme.error(`✗ (${hook.requirements.os.join(", ")})`)
          : theme.success(`✓ (${hook.requirements.os.join(", ")})`);
      lines.push(`${theme.muted(t("hooksFormat.osLabel"))} ${osStatus}`);
    }
  }

  return lines.join("\n");
}

/**
 * Format check output
 */
export function formatHooksCheck(report: HookStatusReport, opts: HooksCheckOptions): string {
  if (opts.json) {
    const eligible = report.hooks.filter((h) => h.eligible);
    const notEligible = report.hooks.filter((h) => !h.eligible);
    return JSON.stringify(
      {
        total: report.hooks.length,
        eligible: eligible.length,
        notEligible: notEligible.length,
        hooks: {
          eligible: eligible.map((h) => h.name),
          notEligible: notEligible.map((h) => ({
            name: h.name,
            missing: h.missing,
          })),
        },
      },
      null,
      2,
    );
  }

  const eligible = report.hooks.filter((h) => h.eligible);
  const notEligible = report.hooks.filter((h) => !h.eligible);

  const lines: string[] = [];
  lines.push(theme.heading(t("hooksFormat.hooksStatusHeading")));
  lines.push("");
  lines.push(`${theme.muted(t("hooksFormat.totalHooks"))} ${report.hooks.length}`);
  lines.push(`${theme.success(t("hooksFormat.readyCount"))} ${eligible.length}`);
  lines.push(`${theme.warn(t("hooksFormat.notReadyCount"))} ${notEligible.length}`);

  if (notEligible.length > 0) {
    lines.push("");
    lines.push(theme.heading(t("hooksFormat.hooksNotReadyHeading")));
    for (const hook of notEligible) {
      const reasons = [];
      if (hook.disabled) {
        reasons.push("disabled");
      }
      if (hook.missing.bins.length > 0) {
        reasons.push(`bins: ${hook.missing.bins.join(", ")}`);
      }
      if (hook.missing.anyBins.length > 0) {
        reasons.push(`anyBins: ${hook.missing.anyBins.join(", ")}`);
      }
      if (hook.missing.env.length > 0) {
        reasons.push(`env: ${hook.missing.env.join(", ")}`);
      }
      if (hook.missing.config.length > 0) {
        reasons.push(`config: ${hook.missing.config.join(", ")}`);
      }
      if (hook.missing.os.length > 0) {
        reasons.push(`os: ${hook.missing.os.join(", ")}`);
      }
      lines.push(`  ${hook.emoji ?? "🔗"} ${hook.name} - ${reasons.join("; ")}`);
    }
  }

  return lines.join("\n");
}

export async function enableHook(hookName: string): Promise<void> {
  const config = loadConfig();
  const hook = resolveHookForToggle(buildHooksReport(config), hookName, { requireEligible: true });
  const nextConfig = buildConfigWithHookEnabled({
    config,
    hookName,
    enabled: true,
    ensureHooksEnabled: true,
  });

  await writeConfigFile(nextConfig);
  defaultRuntime.log(
    `${theme.success(t("hooksFormat.enabledHook"))} ${hook.emoji ?? "🔗"} ${theme.command(hookName)}`,
  );
}

export async function disableHook(hookName: string): Promise<void> {
  const config = loadConfig();
  const hook = resolveHookForToggle(buildHooksReport(config), hookName);
  const nextConfig = buildConfigWithHookEnabled({ config, hookName, enabled: false });

  await writeConfigFile(nextConfig);
  defaultRuntime.log(
    `${theme.warn("⏸")} ${t("hooksFormat.disabledHook")} ${hook.emoji ?? "🔗"} ${theme.command(hookName)}`,
  );
}

export function registerHooksCli(program: Command): void {
  const hooks = program
    .command("hooks")
    .description(t("hooksCli.description"))
    .addHelpText(
      "after",
      () =>
        `\n${theme.muted("Docs:")} ${formatDocsLink("/cli/hooks", "docs.openclaw.ai/cli/hooks")}\n`,
    );

  hooks
    .command("list")
    .description(t("hooksCli.listDescription"))
    .option("--eligible", t("hooksCli.eligibleOpt"), false)
    .option("--json", t("hooksCli.jsonOpt"), false)
    .option("-v, --verbose", t("hooksCli.verboseOpt"), false)
    .action(async (opts) =>
      runHooksCliAction(async () => {
        const config = loadConfig();
        const report = buildHooksReport(config);
        defaultRuntime.log(formatHooksList(report, opts));
      }),
    );

  hooks
    .command("info <name>")
    .description(t("hooksCli.infoDescription"))
    .option("--json", t("hooksCli.jsonOpt"), false)
    .action(async (name, opts) =>
      runHooksCliAction(async () => {
        const config = loadConfig();
        const report = buildHooksReport(config);
        defaultRuntime.log(formatHookInfo(report, name, opts));
      }),
    );

  hooks
    .command("check")
    .description(t("hooksCli.checkDescription"))
    .option("--json", t("hooksCli.jsonOpt"), false)
    .action(async (opts) =>
      runHooksCliAction(async () => {
        const config = loadConfig();
        const report = buildHooksReport(config);
        defaultRuntime.log(formatHooksCheck(report, opts));
      }),
    );

  hooks
    .command("enable <name>")
    .description(t("hooksCli.enableDescription"))
    .action(async (name) =>
      runHooksCliAction(async () => {
        await enableHook(name);
      }),
    );

  hooks
    .command("disable <name>")
    .description(t("hooksCli.disableDescription"))
    .action(async (name) =>
      runHooksCliAction(async () => {
        await disableHook(name);
      }),
    );

  hooks
    .command("install")
    .description(t("hooksCli.installDescription"))
    .argument("<path-or-spec>", t("hooksCli.pathArg"))
    .option("-l, --link", t("hooksCli.linkOpt"), false)
    .option("--pin", t("hooksCli.pinOpt"), false)
    .action(async (raw: string, opts: { link?: boolean; pin?: boolean }) => {
      const resolved = resolveUserPath(raw);
      const cfg = loadConfig();

      if (fs.existsSync(resolved)) {
        if (opts.link) {
          const stat = fs.statSync(resolved);
          if (!stat.isDirectory()) {
            defaultRuntime.error(t("hooks.linkedMustBeDir"));
            process.exit(1);
          }

          const existing = cfg.hooks?.internal?.load?.extraDirs ?? [];
          const merged = Array.from(new Set([...existing, resolved]));
          const probe = await installHooksFromPath({ path: resolved, dryRun: true });
          if (!probe.ok) {
            defaultRuntime.error(probe.error);
            process.exit(1);
          }

          let next: OpenClawConfig = {
            ...cfg,
            hooks: {
              ...cfg.hooks,
              internal: {
                ...cfg.hooks?.internal,
                enabled: true,
                load: {
                  ...cfg.hooks?.internal?.load,
                  extraDirs: merged,
                },
              },
            },
          };

          next = enableInternalHookEntries(next, probe.hooks);

          next = recordHookInstall(next, {
            hookId: probe.hookPackId,
            source: "path",
            sourcePath: resolved,
            installPath: resolved,
            version: probe.version,
            hooks: probe.hooks,
          });

          await writeConfigFile(next);
          defaultRuntime.log(t("hooks.linkedHookPath", { path: shortenHomePath(resolved) }));
          logGatewayRestartHint();
          return;
        }

        const result = await installHooksFromPath({
          path: resolved,
          logger: createInstallLogger(),
        });
        if (!result.ok) {
          defaultRuntime.error(result.error);
          process.exit(1);
        }

        let next = enableInternalHookEntries(cfg, result.hooks);

        const source: "archive" | "path" = resolveArchiveKind(resolved) ? "archive" : "path";

        next = recordHookInstall(next, {
          hookId: result.hookPackId,
          source,
          sourcePath: resolved,
          installPath: result.targetDir,
          version: result.version,
          hooks: result.hooks,
        });

        await writeConfigFile(next);
        defaultRuntime.log(t("hooks.installedHooks", { hooks: result.hooks.join(", ") }));
        logGatewayRestartHint();
        return;
      }

      if (opts.link) {
        defaultRuntime.error(t("hooks.linkRequiresPath"));
        process.exit(1);
      }

      if (looksLikeLocalInstallSpec(raw, [".zip", ".tgz", ".tar.gz", ".tar"])) {
        defaultRuntime.error(t("hooks.pathNotFound", { path: resolved }));
        process.exit(1);
      }

      const result = await installHooksFromNpmSpec({
        spec: raw,
        logger: createInstallLogger(),
      });
      if (!result.ok) {
        defaultRuntime.error(result.error);
        process.exit(1);
      }

      let next = enableInternalHookEntries(cfg, result.hooks);
      const installRecord = resolvePinnedNpmInstallRecordForCli(
        raw,
        Boolean(opts.pin),
        result.targetDir,
        result.version,
        result.npmResolution,
        defaultRuntime.log,
        theme.warn,
      );

      next = recordHookInstall(next, {
        hookId: result.hookPackId,
        ...installRecord,
        hooks: result.hooks,
      });
      await writeConfigFile(next);
      defaultRuntime.log(t("hooks.installedHooks", { hooks: result.hooks.join(", ") }));
      logGatewayRestartHint();
    });

  hooks
    .command("update")
    .description(t("hooksCli.updateDescription"))
    .argument("[id]", t("hooksCli.updateIdArg"))
    .option("--all", t("hooksCli.updateAllOpt"), false)
    .option("--dry-run", t("hooksCli.dryRunOpt"), false)
    .action(async (id: string | undefined, opts: HooksUpdateOptions) => {
      const cfg = loadConfig();
      const installs = cfg.hooks?.internal?.installs ?? {};
      const targets = opts.all ? Object.keys(installs) : id ? [id] : [];

      if (targets.length === 0) {
        defaultRuntime.error(t("hooks.provideIdOrAll"));
        process.exit(1);
      }

      let nextCfg = cfg;
      let updatedCount = 0;

      for (const hookId of targets) {
        const record = installs[hookId];
        if (!record) {
          defaultRuntime.log(theme.warn(t("hooks.noInstallRecord", { id: hookId })));
          continue;
        }
        if (record.source !== "npm") {
          defaultRuntime.log(
            theme.warn(t("hooks.skippingSource", { id: hookId, source: record.source })),
          );
          continue;
        }
        if (!record.spec) {
          defaultRuntime.log(theme.warn(t("hooks.missingNpmSpec", { id: hookId })));
          continue;
        }

        let installPath: string;
        try {
          installPath = record.installPath ?? resolveHookInstallDir(hookId);
        } catch (err) {
          defaultRuntime.log(
            theme.error(t("hooks.invalidInstallPath", { id: hookId, error: String(err) })),
          );
          continue;
        }
        const currentVersion = await readInstalledPackageVersion(installPath);

        if (opts.dryRun) {
          const probe = await installHooksFromNpmSpec({
            spec: record.spec,
            mode: "update",
            dryRun: true,
            expectedHookPackId: hookId,
            expectedIntegrity: record.integrity,
            onIntegrityDrift: async (drift) => {
              logIntegrityDriftWarning(hookId, drift);
              return true;
            },
            logger: createInstallLogger(),
          });
          if (!probe.ok) {
            defaultRuntime.log(theme.error(`Failed to check ${hookId}: ${probe.error}`));
            continue;
          }

          const nextVersion = probe.version ?? "unknown";
          const currentLabel = currentVersion ?? "unknown";
          if (currentVersion && probe.version && currentVersion === probe.version) {
            defaultRuntime.log(`${hookId} is up to date (${currentLabel}).`);
          } else {
            defaultRuntime.log(`Would update ${hookId}: ${currentLabel} → ${nextVersion}.`);
          }
          continue;
        }

        const result = await installHooksFromNpmSpec({
          spec: record.spec,
          mode: "update",
          expectedHookPackId: hookId,
          expectedIntegrity: record.integrity,
          onIntegrityDrift: async (drift) => {
            logIntegrityDriftWarning(hookId, drift);
            return await promptYesNo(`Continue updating "${hookId}" with this artifact?`);
          },
          logger: createInstallLogger(),
        });
        if (!result.ok) {
          defaultRuntime.log(theme.error(`Failed to update ${hookId}: ${result.error}`));
          continue;
        }

        const nextVersion = result.version ?? (await readInstalledPackageVersion(result.targetDir));
        nextCfg = recordHookInstall(nextCfg, {
          hookId,
          ...buildNpmInstallRecordFields({
            spec: record.spec,
            installPath: result.targetDir,
            version: nextVersion,
            resolution: result.npmResolution,
          }),
          hooks: result.hooks,
        });
        updatedCount += 1;

        const currentLabel = currentVersion ?? "unknown";
        const nextLabel = nextVersion ?? "unknown";
        if (currentVersion && nextVersion && currentVersion === nextVersion) {
          defaultRuntime.log(`${hookId} already at ${currentLabel}.`);
        } else {
          defaultRuntime.log(`Updated ${hookId}: ${currentLabel} → ${nextLabel}.`);
        }
      }

      if (updatedCount > 0) {
        await writeConfigFile(nextCfg);
        logGatewayRestartHint();
      }
    });

  hooks.action(async () =>
    runHooksCliAction(async () => {
      const config = loadConfig();
      const report = buildHooksReport(config);
      defaultRuntime.log(formatHooksList(report, {}));
    }),
  );
}
