import { describe, expect, it } from "vitest";
import { getTaglines } from "../i18n/index.js";
import { pickTagline } from "./tagline.js";

describe("pickTagline", () => {
  it("returns empty string when mode is off", () => {
    expect(pickTagline({ mode: "off" })).toBe("");
  });

  it("returns default tagline when mode is default", () => {
    expect(pickTagline({ mode: "default" })).toBe(getTaglines().default);
  });

  it("keeps OPENCLAW_TAGLINE_INDEX behavior in random mode", () => {
    const value = pickTagline({
      mode: "random",
      env: { OPENCLAW_TAGLINE_INDEX: "0" } as NodeJS.ProcessEnv,
    });
    expect(value.length).toBeGreaterThan(0);
    expect(value).not.toBe(getTaglines().default);
  });
});
