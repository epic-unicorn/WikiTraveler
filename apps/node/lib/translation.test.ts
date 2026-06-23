import { describe, it, expect, vi, beforeEach } from "vitest";
import { hashSourceText, toDeepLLang, isTranslationEnabled } from "./translation";

describe("translation helpers", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it("maps locales to DeepL codes", () => {
    expect(toDeepLLang("nl")).toBe("NL");
    expect(toDeepLLang("en")).toBe("EN");
    expect(toDeepLLang("xx")).toBeNull();
  });

  it("detects translation enabled from env", () => {
    vi.stubEnv("DEEPL_API_KEY", "");
    expect(isTranslationEnabled()).toBe(false);
    vi.stubEnv("DEEPL_API_KEY", "test-key");
    expect(isTranslationEnabled()).toBe(true);
    vi.stubEnv("TRANSLATION_ENABLED", "false");
    expect(isTranslationEnabled()).toBe(false);
  });

  it("hashes source text consistently", () => {
    const a = hashSourceText("hello");
    const b = hashSourceText("hello");
    expect(a).toBe(b);
    expect(a).not.toBe(hashSourceText("world"));
  });
});
