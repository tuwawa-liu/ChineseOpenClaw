import { describe, it, expect, beforeEach } from "vitest";
import { i18n, t } from "../lib/translate.ts";

describe("i18n", () => {
  beforeEach(async () => {
    localStorage.clear();
    await i18n.setLocale("zh-CN");
  });

  it("should return the key if translation is missing", () => {
    expect(t("non.existent.key")).toBe("non.existent.key");
  });

  it("should return the correct Chinese translation", () => {
    expect(t("common.health")).toBe("健康状况");
  });

  it("should replace parameters correctly", () => {
    expect(t("overview.stats.cronNext", { time: "10:00" })).toBe("下次唤醒 10:00");
  });

  it("should return key when translation is not found", async () => {
    expect(t("totally.nonexistent.key")).toBe("totally.nonexistent.key");
  });

  it("default locale is zh-CN", () => {
    expect(i18n.getLocale()).toBe("zh-CN");
  });
});
