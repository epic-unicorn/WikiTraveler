import { describe, it, expect } from "vitest";
import { formatFactValue, resolveFactDisplay, isProseField } from "@wikitraveler/i18n";

describe("formatFactValue", () => {
  it("translates yes/no by locale", () => {
    expect(formatFactValue("ramp_present", "yes", { locale: "nl" }).displayValue).toBe("Ja");
    expect(formatFactValue("ramp_present", "no", { locale: "fr" }).displayValue).toBe("Non");
  });

  it("treats OSM true/false and n/a as boolean tokens", () => {
    expect(formatFactValue("ramp_present", "true", { locale: "nl" }).displayValue).toBe("Ja");
    expect(formatFactValue("ramp_present", "false", { locale: "nl" }).displayValue).toBe("Nee");
    expect(formatFactValue("pool_lift", "n/a", { locale: "nl" }).displayValue).toBe("n.v.t.");
  });

  it("translates path_to_entrance enum tokens", () => {
    expect(formatFactValue("path_to_entrance", "step_free", { locale: "nl" }).displayValue).toBe(
      "Drempelloos"
    );
    expect(
      formatFactValue("path_to_entrance", "step_free,uneven,steep", { locale: "nl" }).displayValue
    ).toBe("Drempelloos, Oneffen, Steil");
    expect(formatFactValue("path_to_entrance", "steep", { locale: "en" }).displayValue).toBe("Steep");
  });

  it("keeps prose as original when locales match", () => {
    const text = "Douche plain-pied";
    const result = formatFactValue("notes", text, {
      locale: "fr",
      valueLocale: "fr",
    });
    expect(result.displayValue).toBe(text);
    expect(result.isProse).toBe(true);
    expect(isProseField("notes")).toBe(true);
  });

  it("uses translated prose when provided", () => {
    const result = formatFactValue("accessible_room_description", "Bonjour", {
      locale: "nl",
      valueLocale: "fr",
      translatedValue: "Hallo",
      machineTranslated: true,
    });
    expect(result.displayValue).toBe("Hallo");
    expect(result.machineTranslated).toBe(true);
  });

  it("uses translated prose without valueLocale when machine translated", () => {
    const result = formatFactValue("notes", "Hello world", {
      locale: "nl",
      translatedValue: "Hallo wereld",
      machineTranslated: true,
    });
    expect(result.displayValue).toBe("Hallo wereld");
    expect(result.machineTranslated).toBe(true);
  });
});

describe("resolveFactDisplay", () => {
  it("formats AI evidence when value is confidence-only", () => {
    const { displayValue } = resolveFactDisplay(
      {
        fieldName: "ramp_present",
        value: "high",
        tier: "AI_GUESS",
        signatureHash: JSON.stringify({ confidence: "high", evidence: "Ramp visible" }),
      },
      "en"
    );
    expect(displayValue).toBe("Ramp visible");
  });
});
