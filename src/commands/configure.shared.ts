import {
  confirm as clackConfirm,
  intro as clackIntro,
  outro as clackOutro,
  select as clackSelect,
  text as clackText,
} from "@clack/prompts";
import { t } from "../i18n/index.js";
import { stylePromptHint, stylePromptMessage, stylePromptTitle } from "../terminal/prompt-style.js";

export const CONFIGURE_WIZARD_SECTIONS = [
  "workspace",
  "model",
  "web",
  "gateway",
  "daemon",
  "channels",
  "skills",
  "health",
] as const;

export type WizardSection = (typeof CONFIGURE_WIZARD_SECTIONS)[number];

export function parseConfigureWizardSections(raw: unknown): {
  sections: WizardSection[];
  invalid: string[];
} {
  const sectionsRaw: string[] = Array.isArray(raw)
    ? raw.map((value: unknown) => (typeof value === "string" ? value.trim() : "")).filter(Boolean)
    : [];
  if (sectionsRaw.length === 0) {
    return { sections: [], invalid: [] };
  }

  const invalid = sectionsRaw.filter((s) => !CONFIGURE_WIZARD_SECTIONS.includes(s as never));
  const sections = sectionsRaw.filter((s): s is WizardSection =>
    CONFIGURE_WIZARD_SECTIONS.includes(s as never),
  );
  return { sections, invalid };
}

export type ChannelsWizardMode = "configure" | "remove";

export type ConfigureWizardParams = {
  command: "configure" | "update";
  sections?: WizardSection[];
};

export const CONFIGURE_SECTION_OPTIONS: Array<{
  value: WizardSection;
  label: string;
  hint: string;
}> = [
  { value: "workspace", label: t("commands.configShared.workspaceLabel"), hint: t("commands.configShared.workspaceHint") },
  { value: "model", label: t("commands.configShared.modelLabel"), hint: t("commands.configShared.modelHint") },
  { value: "web", label: t("commands.configShared.webLabel"), hint: t("commands.configShared.webHint") },
  { value: "gateway", label: t("commands.configShared.gatewayLabel"), hint: t("commands.configShared.gatewayHint") },
  {
    value: "daemon",
    label: t("commands.configShared.daemonLabel"),
    hint: t("commands.configShared.daemonHint"),
  },
  {
    value: "channels",
    label: t("commands.configShared.channelsLabel"),
    hint: t("commands.configShared.channelsHint"),
  },
  { value: "skills", label: t("commands.configShared.skillsLabel"), hint: t("commands.configShared.skillsHint") },
  {
    value: "health",
    label: t("commands.configShared.healthLabel"),
    hint: t("commands.configShared.healthHint"),
  },
];

export const intro = (message: string) => clackIntro(stylePromptTitle(message) ?? message);
export const outro = (message: string) => clackOutro(stylePromptTitle(message) ?? message);
export const text = (params: Parameters<typeof clackText>[0]) =>
  clackText({
    ...params,
    message: stylePromptMessage(params.message),
  });
export const confirm = (params: Parameters<typeof clackConfirm>[0]) =>
  clackConfirm({
    ...params,
    message: stylePromptMessage(params.message),
  });
export const select = <T>(params: Parameters<typeof clackSelect<T>>[0]) =>
  clackSelect({
    ...params,
    message: stylePromptMessage(params.message),
    options: params.options.map((opt) =>
      opt.hint === undefined ? opt : { ...opt, hint: stylePromptHint(opt.hint) },
    ),
  });
