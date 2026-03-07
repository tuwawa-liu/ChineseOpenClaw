import type { OpenClawConfig } from "../config/config.js";
import { t } from "../i18n/index.js";
import type { ApplyAuthChoiceParams, ApplyAuthChoiceResult } from "./auth-choice.apply.js";
import { promptAndConfigureVllm } from "./vllm-setup.js";

function applyVllmDefaultModel(cfg: OpenClawConfig, modelRef: string): OpenClawConfig {
  const existingModel = cfg.agents?.defaults?.model;
  const fallbacks =
    existingModel && typeof existingModel === "object" && "fallbacks" in existingModel
      ? (existingModel as { fallbacks?: string[] }).fallbacks
      : undefined;

  return {
    ...cfg,
    agents: {
      ...cfg.agents,
      defaults: {
        ...cfg.agents?.defaults,
        model: {
          ...(fallbacks ? { fallbacks } : undefined),
          primary: modelRef,
        },
      },
    },
  };
}

export async function applyAuthChoiceVllm(
  params: ApplyAuthChoiceParams,
): Promise<ApplyAuthChoiceResult | null> {
  if (params.authChoice !== "vllm") {
    return null;
  }

  const { config: nextConfig, modelRef } = await promptAndConfigureVllm({
    cfg: params.config,
    prompter: params.prompter,
    agentDir: params.agentDir,
  });

  if (!params.setDefaultModel) {
    return { config: nextConfig, agentModelOverride: modelRef };
  }

  await params.prompter.note(t("commands.authDefaultModel.modelSet", { model: modelRef }), t("commands.authDefaultModel.modelConfigured"));
  return { config: applyVllmDefaultModel(nextConfig, modelRef) };
}
