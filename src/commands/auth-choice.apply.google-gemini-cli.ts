import { t } from "../i18n/index.js";
import type { ApplyAuthChoiceParams, ApplyAuthChoiceResult } from "./auth-choice.apply.js";
import { applyAuthChoicePluginProvider } from "./auth-choice.apply.plugin-provider.js";

export async function applyAuthChoiceGoogleGeminiCli(
  params: ApplyAuthChoiceParams,
): Promise<ApplyAuthChoiceResult | null> {
  if (params.authChoice !== "google-gemini-cli") {
    return null;
  }

  await params.prompter.note(
    t("commands.authGeminiCli.cautionNote"),
    t("commands.authGeminiCli.cautionTitle"),
  );

  const proceed = await params.prompter.confirm({
    message: t("commands.authGeminiCli.continueConfirm"),
    initialValue: false,
  });

  if (!proceed) {
    await params.prompter.note(t("commands.authGeminiCli.skipNote"), t("commands.authGeminiCli.skipTitle"));
    return { config: params.config };
  }

  return await applyAuthChoicePluginProvider(params, {
    authChoice: "google-gemini-cli",
    pluginId: "google-gemini-cli-auth",
    providerId: "google-gemini-cli",
    methodId: "oauth",
    label: "Google Gemini CLI",
  });
}
