import { t } from "../i18n/index.js";
import type { RuntimeEnv } from "../runtime.js";
import type { WizardPrompter } from "../wizard/prompts.js";

type OAuthPrompt = { message: string; placeholder?: string };

const validateRequiredInput = (value: string) => (value.trim().length > 0 ? undefined : t("commands.oauthFlow.required"));

export function createVpsAwareOAuthHandlers(params: {
  isRemote: boolean;
  prompter: WizardPrompter;
  runtime: RuntimeEnv;
  spin: ReturnType<WizardPrompter["progress"]>;
  openUrl: (url: string) => Promise<unknown>;
  localBrowserMessage: string;
  manualPromptMessage?: string;
}): {
  onAuth: (event: { url: string }) => Promise<void>;
  onPrompt: (prompt: OAuthPrompt) => Promise<string>;
} {
  const manualPromptMessage = params.manualPromptMessage ?? t("commands.oauthFlow.pasteRedirectUrl");
  let manualCodePromise: Promise<string> | undefined;

  return {
    onAuth: async ({ url }) => {
      if (params.isRemote) {
        params.spin.stop(t("commands.oauthFlow.oauthUrlReady"));
        params.runtime.log(t("commands.oauthFlow.openBrowserUrl", { url }));
        manualCodePromise = params.prompter
          .text({
            message: manualPromptMessage,
            validate: validateRequiredInput,
          })
          .then((value) => String(value));
        return;
      }

      params.spin.update(params.localBrowserMessage);
      await params.openUrl(url);
      params.runtime.log(t("commands.oauthFlow.openUrl", { url }));
    },
    onPrompt: async (prompt) => {
      if (manualCodePromise) {
        return manualCodePromise;
      }
      const code = await params.prompter.text({
        message: prompt.message,
        placeholder: prompt.placeholder,
        validate: validateRequiredInput,
      });
      return String(code);
    },
  };
}
