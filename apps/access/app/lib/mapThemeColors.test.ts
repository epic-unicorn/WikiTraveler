import { describe, expect, it } from "vitest";
import { readMapPinColors } from "./mapThemeColors";

describe("readMapPinColors", () => {
  it("returns fallback colors when document is unavailable", () => {
    expect(readMapPinColors()).toEqual({
      stroke: "#1d4ed8",
      fill: "#60a5fa",
    });
  });
});
