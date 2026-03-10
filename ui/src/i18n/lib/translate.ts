import { zh_CN } from "../locales/zh-CN.ts";
import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  isSupportedLocale,
} from "./registry.ts";
import type { Locale, TranslationMap } from "./types.ts";

type Subscriber = (locale: Locale) => void;

export { SUPPORTED_LOCALES, isSupportedLocale };

class I18nManager {
  private locale: Locale = DEFAULT_LOCALE;
  private translations: Record<Locale, TranslationMap> = { "zh-CN": zh_CN };
  private subscribers: Set<Subscriber> = new Set();

  public getLocale(): Locale {
    return this.locale;
  }

  public async setLocale(_locale: Locale) {
    // 只有中文，无需切换
  }

  public subscribe(sub: Subscriber) {
    this.subscribers.add(sub);
    return () => this.subscribers.delete(sub);
  }

  public t(key: string, params?: Record<string, string>): string {
    const keys = key.split(".");
    let value: unknown = this.translations[this.locale];

    for (const k of keys) {
      if (value && typeof value === "object") {
        value = (value as Record<string, unknown>)[k];
      } else {
        value = undefined;
        break;
      }
    }

    if (typeof value !== "string") {
      return key;
    }

    if (params) {
      return value.replace(/\{(\w+)\}/g, (_, k) => params[k] || `{${k}}`);
    }

    return value;
  }
}

export const i18n = new I18nManager();
export const t = (key: string, params?: Record<string, string>) => i18n.t(key, params);
