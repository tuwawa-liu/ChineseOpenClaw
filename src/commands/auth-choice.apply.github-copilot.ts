import { toAgentModelListLike } from "../config/model-input.js";
import { t } from "../i18n/index.js";
import { githubCopilotLoginCommand } from "../providers/github-copilot-auth.js";
import type { ApplyAuthChoiceParams, ApplyAuthChoiceResult } from "./auth-choice.apply.js";
import { applyAuthProfileConfig } from "./onboard-auth.js";

export async function applyAuthChoiceGitHubCopilot(
  params: ApplyAuthChoiceParams,
): Promise<ApplyAuthChoiceResult | null> {
  if (params.authChoice !== "github-copilot") {
    return null;
  }

  let nextConfig = params.config;

  await params.prompter.note(
    [
      t("commands.authGithubCopilot.loginNote"),
    ].join("\n"),
    "GitHub Copilot",
  );

  if (!process.stdin.isTTY) {
    await params.prompter.note(
      t("commands.authGithubCopilot.ttyRequired"),
      "GitHub Copilot",
    );
    return { config: nextConfig };
  }

  try {
    await githubCopilotLoginCommand({ yes: true }, params.runtime);
  } catch (err) {
    await params.prompter.note(t("commands.authGithubCopilot.loginFailed", { error: String(err) }), "GitHub Copilot");
    return { config: nextConfig };
  }

  nextConfig = applyAuthProfileConfig(nextConfig, {
    profileId: "github-copilot:github",
    provider: "github-copilot",
    mode: "token",
  });

  if (params.setDefaultModel) {
    const model = "github-copilot/gpt-4o";
    nextConfig = {
      ...nextConfig,
      agents: {
        ...nextConfig.agents,
        defaults: {
          ...nextConfig.agents?.defaults,
          model: {
            ...toAgentModelListLike(nextConfig.agents?.defaults?.model),
            primary: model,
          },
        },
      },
    };
    await params.prompter.note(t("commands.authDefaultModel.modelSet", { model }), t("commands.authDefaultModel.modelConfigured"));
  }

  return { config: nextConfig };
}
