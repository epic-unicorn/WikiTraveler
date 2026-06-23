import { describe, it, expect } from "vitest";
import { formatFactValue, resolveFactDisplay, isProseField } from "@wikitraveler/i18n";

describe("formatFactValue", () => {
  it("translates yes/no by locale", () => {
    expect(formatFactValue("ramp_present", "yes", { locale: "nl" }).displayValue).toBe("Ja");
    expect(formatFactValue("ramp_present", "no", { locale: "fr" }).displayValue).toBe("Non");
  });

  it("translates room type lists", () => {
    const result = formatFactValue("room_types_available", "double,accessible_king", {
      locale: "nl",
    });
    expect(result.displayValue).toContain("Standaard tweepersoons");
    expect(result.displayValue).toContain("Toegankelijke king");
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
