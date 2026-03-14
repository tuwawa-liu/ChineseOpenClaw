import { resolveAgentWorkspaceDir, resolveDefaultAgentId } from "../../agents/agent-scope.js";
import { listChannelPluginCatalogEntries } from "../../channels/plugins/catalog.js";
import { parseOptionalDelimitedEntries } from "../../channels/plugins/helpers.js";
import { getChannelPlugin, normalizeChannelId } from "../../channels/plugins/index.js";
import { t } from "../../i18n/index.js";
import { moveSingleAccountChannelSectionToDefaultAccount } from "../../channels/plugins/setup-helpers.js";
import type { ChannelId, ChannelSetupInput } from "../../channels/plugins/types.js";
import { writeConfigFile, type OpenClawConfig } from "../../config/config.js";
import { DEFAULT_ACCOUNT_ID, normalizeAccountId } from "../../routing/session-key.js";
import { defaultRuntime, type RuntimeEnv } from "../../runtime.js";
import { resolveTelegramAccount } from "../../telegram/accounts.js";
import { deleteTelegramUpdateOffset } from "../../telegram/update-offset-store.js";
import { createClackPrompter } from "../../wizard/clack-prompter.js";
import { applyAgentBindings, describeBinding } from "../agents.bindings.js";
import { buildAgentSummaries } from "../agents.config.js";
import { setupChannels } from "../onboard-channels.js";
import type { ChannelChoice } from "../onboard-types.js";
import {
  ensureOnboardingPluginInstalled,
  reloadOnboardingPluginRegistry,
} from "../onboarding/plugin-install.js";
import { applyAccountName, applyChannelAccountConfig } from "./add-mutators.js";
import { channelLabel, requireValidConfig, shouldUseWizard } from "./shared.js";

export type ChannelsAddOptions = {
  channel?: string;
  account?: string;
  initialSyncLimit?: number | string;
  groupChannels?: string;
  dmAllowlist?: string;
} & Omit<ChannelSetupInput, "groupChannels" | "dmAllowlist" | "initialSyncLimit">;

function resolveCatalogChannelEntry(raw: string, cfg: OpenClawConfig | null) {
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) {
    return undefined;
  }
  const workspaceDir = cfg ? resolveAgentWorkspaceDir(cfg, resolveDefaultAgentId(cfg)) : undefined;
  return listChannelPluginCatalogEntries({ workspaceDir }).find((entry) => {
    if (entry.id.toLowerCase() === trimmed) {
      return true;
    }
    return (entry.meta.aliases ?? []).some((alias) => alias.trim().toLowerCase() === trimmed);
  });
}

export async function channelsAddCommand(
  opts: ChannelsAddOptions,
  runtime: RuntimeEnv = defaultRuntime,
  params?: { hasFlags?: boolean },
) {
  const cfg = await requireValidConfig(runtime);
  if (!cfg) {
    return;
  }
  let nextConfig = cfg;

  const useWizard = shouldUseWizard(params);
  if (useWizard) {
    const prompter = createClackPrompter();
    let selection: ChannelChoice[] = [];
    const accountIds: Partial<Record<ChannelChoice, string>> = {};
    await prompter.intro(t("commands.channelsAdd.channelSetup"));
    let nextConfig = await setupChannels(cfg, runtime, prompter, {
      allowDisable: false,
      allowSignalInstall: true,
      promptAccountIds: true,
      onSelection: (value) => {
        selection = value;
      },
      onAccountId: (channel, accountId) => {
        accountIds[channel] = accountId;
      },
    });
    if (selection.length === 0) {
      await prompter.outro(t("commands.channelsAdd.noChannelsSelected"));
      return;
    }

    const wantsNames = await prompter.confirm({
      message: t("commands.channelsAdd.addDisplayNames"),
      initialValue: false,
    });
    if (wantsNames) {
      for (const channel of selection) {
        const accountId = accountIds[channel] ?? DEFAULT_ACCOUNT_ID;
        const plugin = getChannelPlugin(channel);
        const account = plugin?.config.resolveAccount(nextConfig, accountId) as
          | { name?: string }
          | undefined;
        const snapshot = plugin?.config.describeAccount?.(account, nextConfig);
        const existingName = snapshot?.name ?? account?.name;
        const name = await prompter.text({
          message: t("commands.channelsAdd.accountName", { channel, accountId }),
          initialValue: existingName,
        });
        if (name?.trim()) {
          nextConfig = applyAccountName({
            cfg: nextConfig,
            channel,
            accountId,
            name,
          });
        }
      }
    }

    const bindTargets = selection
      .map((channel) => ({
        channel,
        accountId: accountIds[channel]?.trim(),
      }))
      .filter(
        (
          value,
        ): value is {
          channel: ChannelChoice;
          accountId: string;
        } => Boolean(value.accountId),
      );
    if (bindTargets.length > 0) {
      const bindNow = await prompter.confirm({
        message: t("commands.channelsAdd.bindNow"),
        initialValue: true,
      });
      if (bindNow) {
        const agentSummaries = buildAgentSummaries(nextConfig);
        const defaultAgentId = resolveDefaultAgentId(nextConfig);
        for (const target of bindTargets) {
          const targetAgentId = await prompter.select({
            message: t("commands.channelsAdd.routeToAgent", { channel: target.channel, accountId: target.accountId }),
            options: agentSummaries.map((agent) => ({
              value: agent.id,
              label: agent.isDefault ? `${agent.id} (default)` : agent.id,
            })),
            initialValue: defaultAgentId,
          });
          const bindingResult = applyAgentBindings(nextConfig, [
            {
              agentId: targetAgentId,
              match: { channel: target.channel, accountId: target.accountId },
            },
          ]);
          nextConfig = bindingResult.config;
          if (bindingResult.added.length > 0 || bindingResult.updated.length > 0) {
            await prompter.note(
              [
                ...bindingResult.added.map((binding) => t("commands.channelsAdd.added", { binding: describeBinding(binding) })),
                ...bindingResult.updated.map((binding) => t("commands.channelsAdd.updated", { binding: describeBinding(binding) })),
              ].join("\n"),
              t("commands.channelsAdd.routingBindings"),
            );
          }
          if (bindingResult.conflicts.length > 0) {
            await prompter.note(
              [
                t("commands.channelsAdd.skippedBindings"),
                ...bindingResult.conflicts.map(
                  (conflict) =>
                    `- ${describeBinding(conflict.binding)} (agent=${conflict.existingAgentId})`,
                ),
              ].join("\n"),
              t("commands.channelsAdd.routingBindings"),
            );
          }
        }
      }
    }

    await writeConfigFile(nextConfig);
    await prompter.outro(t("commands.channelsAdd.channelsUpdated"));
    return;
  }

  const rawChannel = String(opts.channel ?? "");
  let channel = normalizeChannelId(rawChannel);
  let catalogEntry = channel ? undefined : resolveCatalogChannelEntry(rawChannel, nextConfig);

  if (!channel && catalogEntry) {
    const prompter = createClackPrompter();
    const workspaceDir = resolveAgentWorkspaceDir(nextConfig, resolveDefaultAgentId(nextConfig));
    const result = await ensureOnboardingPluginInstalled({
      cfg: nextConfig,
      entry: catalogEntry,
      prompter,
      runtime,
      workspaceDir,
    });
    nextConfig = result.cfg;
    if (!result.installed) {
      return;
    }
    reloadOnboardingPluginRegistry({ cfg: nextConfig, runtime, workspaceDir });
    channel = normalizeChannelId(catalogEntry.id) ?? (catalogEntry.id as ChannelId);
  }

  if (!channel) {
    const hint = catalogEntry
      ? t("commands.channelsAdd.pluginLoadFailed", { label: catalogEntry.meta.label })
      : t("commands.channelsAdd.unknownChannel", { channel: String(opts.channel ?? "") });
    runtime.error(hint);
    runtime.exit(1);
    return;
  }

  const plugin = getChannelPlugin(channel);
  if (!plugin?.setup?.applyAccountConfig) {
    runtime.error(t("commands.channelsAdd.noSupportAdd", { channel }));
    runtime.exit(1);
    return;
  }
  const useEnv = opts.useEnv === true;
  const initialSyncLimit =
    typeof opts.initialSyncLimit === "number"
      ? opts.initialSyncLimit
      : typeof opts.initialSyncLimit === "string" && opts.initialSyncLimit.trim()
        ? Number.parseInt(opts.initialSyncLimit, 10)
        : undefined;
  const groupChannels = parseOptionalDelimitedEntries(opts.groupChannels);
  const dmAllowlist = parseOptionalDelimitedEntries(opts.dmAllowlist);

  const input: ChannelSetupInput = {
    name: opts.name,
    token: opts.token,
    tokenFile: opts.tokenFile,
    botToken: opts.botToken,
    appToken: opts.appToken,
    signalNumber: opts.signalNumber,
    cliPath: opts.cliPath,
    dbPath: opts.dbPath,
    service: opts.service,
    region: opts.region,
    authDir: opts.authDir,
    httpUrl: opts.httpUrl,
    httpHost: opts.httpHost,
    httpPort: opts.httpPort,
    webhookPath: opts.webhookPath,
    webhookUrl: opts.webhookUrl,
    audienceType: opts.audienceType,
    audience: opts.audience,
    homeserver: opts.homeserver,
    userId: opts.userId,
    accessToken: opts.accessToken,
    password: opts.password,
    deviceName: opts.deviceName,
    initialSyncLimit,
    useEnv,
    ship: opts.ship,
    url: opts.url,
    code: opts.code,
    groupChannels,
    dmAllowlist,
    autoDiscoverChannels: opts.autoDiscoverChannels,
  };
  const accountId =
    plugin.setup.resolveAccountId?.({
      cfg: nextConfig,
      accountId: opts.account,
      input,
    }) ?? normalizeAccountId(opts.account);

  const validationError = plugin.setup.validateInput?.({
    cfg: nextConfig,
    accountId,
    input,
  });
  if (validationError) {
    runtime.error(validationError);
    runtime.exit(1);
    return;
  }

  const previousTelegramToken =
    channel === "telegram"
      ? resolveTelegramAccount({ cfg: nextConfig, accountId }).token.trim()
      : "";

  if (accountId !== DEFAULT_ACCOUNT_ID) {
    nextConfig = moveSingleAccountChannelSectionToDefaultAccount({
      cfg: nextConfig,
      channelKey: channel,
    });
  }

  nextConfig = applyChannelAccountConfig({
    cfg: nextConfig,
    channel,
    accountId,
    input,
  });

  if (channel === "telegram") {
    const nextTelegramToken = resolveTelegramAccount({ cfg: nextConfig, accountId }).token.trim();
    if (previousTelegramToken !== nextTelegramToken) {
      // Clear stale polling offsets after Telegram token rotation.
      await deleteTelegramUpdateOffset({ accountId });
    }
  }

  await writeConfigFile(nextConfig);
  runtime.log(t("commands.channelsAdd.addedAccount", { label: channelLabel(channel), accountId }));
}
