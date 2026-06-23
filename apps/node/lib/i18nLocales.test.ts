import { describe, expect, it } from "vitest";
import en from "../../packages/i18n/src/locales/en.json";
import nl from "../../packages/i18n/src/locales/nl.json";
import de from "../../packages/i18n/src/locales/de.json";
import fr from "../../packages/i18n/src/locales/fr.json";

type LocaleFile = typeof en;

const LOCALES: Record<string, LocaleFile> = { en, nl, de, fr };

function collectKeys(obj: Record<string, unknown>, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return collectKeys(value as Record<string, unknown>, path);
    }
    return [path];
  });
}

describe("i18n locale parity", () => {
  const enKeys = collectKeys(en as unknown as Record<string, unknown>).sort();

  for (const [code, catalog] of Object.entries(LOCALES)) {
    if (code === "en") continue;

    it(`${code}.json has all keys from en.json`, () => {
      const keys = new Set(collectKeys(catalog as unknown as Record<string, unknown>));
      const missing = enKeys.filter((k) => !keys.has(k));
      expect(missing, `Missing in ${code}: ${missing.join(", ")}`).toEqual([]);
    });
  }

  it("includes new region and registration keys in en", () => {
    expect(en.ui.regionNotConfigured).toBeTruthy();
    expect(en.ui.regionConfigureLink).toBeTruthy();
    expect(en.ui.regionEmptyMap).toBeTruthy();
    expect(en.ui.authRegistrationClosed).toBeTruthy();
  });
});
