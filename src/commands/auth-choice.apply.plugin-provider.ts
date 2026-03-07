import { resolveOpenClawAgentDir } from "../agents/agent-paths.js";
import { t } from "../i18n/index.js";
import {
  resolveDefaultAgentId,
  resolveAgentDir,
  resolveAgentWorkspaceDir,
} from "../agents/agent-scope.js";
import { upsertAuthProfile } from "../agents/auth-profiles.js";
import { resolveDefaultAgentWorkspaceDir } from "../agents/workspace.js";
import { enablePluginInConfig } from "../plugins/enable.js";
import { resolvePluginProviders } from "../plugins/providers.js";
import type { ApplyAuthChoiceParams, ApplyAuthChoiceResult } from "./auth-choice.apply.js";
import { isRemoteEnvironment } from "./oauth-env.js";
import { createVpsAwareOAuthHandlers } from "./oauth-flow.js";
import { applyAuthProfileConfig } from "./onboard-auth.js";
import { openUrl } from "./onboard-helpers.js";
import {
  applyDefaultModel,
  mergeConfigPatch,
  pickAuthMethod,
  resolveProviderMatch,
} from "./provider-auth-helpers.js";

export type PluginProviderAuthChoiceOptions = {
  authChoice: string;
  pluginId: string;
  providerId: string;
  methodId?: string;
  label: string;
};

export async function applyAuthChoicePluginProvider(
  params: ApplyAuthChoiceParams,
  options: PluginProviderAuthChoiceOptions,
): Promise<ApplyAuthChoiceResult | null> {
  if (params.authChoice !== options.authChoice) {
    return null;
  }

  const enableResult = enablePluginInConfig(params.config, options.pluginId);
  let nextConfig = enableResult.config;
  if (!enableResult.enabled) {
    await params.prompter.note(
      t("commands.authPluginProvider.pluginDisabled", { label: options.label, reason: enableResult.reason ?? "blocked" }),
      options.label,
    );
    return { config: nextConfig };
  }

  const agentId = params.agentId ?? resolveDefaultAgentId(nextConfig);
  const defaultAgentId = resolveDefaultAgentId(nextConfig);
  const agentDir =
    params.agentDir ??
    (agentId === defaultAgentId ? resolveOpenClawAgentDir() : resolveAgentDir(nextConfig, agentId));
  const workspaceDir =
    resolveAgentWorkspaceDir(nextConfig, agentId) ?? resolveDefaultAgentWorkspaceDir();

  const providers = resolvePluginProviders({ config: nextConfig, workspaceDir });
  const provider = resolveProviderMatch(providers, options.providerId);
  if (!provider) {
    await params.prompter.note(
      t("commands.authPluginProvider.pluginNotAvailable", { label: options.label }),
      options.label,
    );
    return { config: nextConfig };
  }

  const method = pickAuthMethod(provider, options.methodId) ?? provider.auth[0];
  if (!method) {
    await params.prompter.note(t("commands.authPluginProvider.authMethodMissing", { label: options.label }), options.label);
    return { config: nextConfig };
  }

  const isRemote = isRemoteEnvironment();
  const result = await method.run({
    config: nextConfig,
    agentDir,
    workspaceDir,
    prompter: params.prompter,
    runtime: params.runtime,
    isRemote,
    openUrl: async (url) => {
      await openUrl(url);
    },
    oauth: {
      createVpsAwareHandlers: (opts) => createVpsAwareOAuthHandlers(opts),
    },
  });

  if (result.configPatch) {
    nextConfig = mergeConfigPatch(nextConfig, result.configPatch);
  }

  for (const profile of result.profiles) {
    upsertAuthProfile({
      profileId: profile.profileId,
      credential: profile.credential,
      agentDir,
    });

    nextConfig = applyAuthProfileConfig(nextConfig, {
      profileId: profile.profileId,
      provider: profile.credential.provider,
      mode: profile.credential.type === "token" ? "token" : profile.credential.type,
      ...("email" in profile.credential && profile.credential.email
        ? { email: profile.credential.email }
        : {}),
    });
  }

  let agentModelOverride: string | undefined;
  if (result.defaultModel) {
    if (params.setDefaultModel) {
      nextConfig = applyDefaultModel(nextConfig, result.defaultModel);
      await params.prompter.note(t("commands.authDefaultModel.modelSet", { model: result.defaultModel }), t("commands.authDefaultModel.modelConfigured"));
    } else if (params.agentId) {
      agentModelOverride = result.defaultModel;
      await params.prompter.note(
        t("commands.authHelpers.modelSetDefault", { model: result.defaultModel, agentId: params.agentId }),
        t("commands.authDefaultModel.modelConfigured"),
      );
    }
  }

  if (result.notes && result.notes.length > 0) {
    await params.prompter.note(result.notes.join("\n"), t("commands.authPluginProvider.providerNotes"));
  }

  return { config: nextConfig, agentModelOverride };
}
