import type { CliLocale, TaglineSet, TranslationMap } from "./types.js";
import { zh_CN, zhCNTaglines } from "./locales/zh-CN.js";

let currentLocale: CliLocale = "zh-CN";
const translations: Partial<Record<CliLocale, TranslationMap>> = { "zh-CN": zh_CN };
let taglines: TaglineSet = zhCNTaglines;

export function getLocale(): CliLocale {
  return currentLocale;
}

export function setLocale(locale: CliLocale) {
  currentLocale = locale;
}

export async function ensureLocaleLoaded(): Promise<void> {}

export function getTaglines(): TaglineSet {
  return taglines;
}

function lookup(map: TranslationMap | undefined, keys: string[]): string | undefined {
  let value: unknown = map;
  for (const k of keys) {
    if (value && typeof value === "object") {
      value = (value as Record<string, unknown>)[k];
    } else {
      return undefined;
    }
  }
  return typeof value === "string" ? value : undefined;
}

export function t(key: string, params?: Record<string, string>): string {
  const keys = key.split(".");
  const value = lookup(translations[currentLocale], keys);
  if (value === undefined) return key;
  if (params) {
    return value.replace(/\{(\w+)\}/g, (_, k: string) => params[k] ?? `{${k}}`);
  }
  return value;
}

export type { CliLocale, TranslationMap };
