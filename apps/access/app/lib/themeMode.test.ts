import { describe, expect, it } from "vitest";
import { parseThemeMode } from "@wikitraveler/ui";

describe("parseThemeMode", () => {
  it("accepts named themes", () => {
    expect(parseThemeMode("light")).toBe("light");
    expect(parseThemeMode("dark")).toBe("dark");
    expect(parseThemeMode("contrast")).toBe("contrast");
    expect(parseThemeMode("calm")).toBe("calm");
  });

  it("maps legacy auto/system and unknown values to standard", () => {
    expect(parseThemeMode("system")).toBe("light");
    expect(parseThemeMode("auto")).toBe("light");
    expect(parseThemeMode(null)).toBe("light");
  });
});
