export type TranslationMap = { [key: string]: string | TranslationMap };
export type CliLocale = "zh-CN";

export interface TaglineSet {
  default: string;
  holiday: Record<string, string>;
  lines: string[];
}
