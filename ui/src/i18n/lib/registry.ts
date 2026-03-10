import type { Locale } from "./types.ts";

export const DEFAULT_LOCALE: Locale = "zh-CN";

export const SUPPORTED_LOCALES: ReadonlyArray<Locale> = [DEFAULT_LOCALE];

export function isSupportedLocale(value: string | null | undefined): value is Locale {
  return value === "zh-CN";
}

export function resolveNavigatorLocale(_navLang: string): Locale {
  return DEFAULT_LOCALE;
}
