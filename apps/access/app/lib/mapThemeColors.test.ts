import { afterEach, describe, expect, it, vi } from "vitest";
import { readMapPinColors } from "./mapThemeColors";

describe("readMapPinColors", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns fallback colors when document is unavailable", () => {
    vi.stubGlobal("document", undefined);
    expect(readMapPinColors()).toEqual({
      stroke: "#1d4ed8",
      fill: "#60a5fa",
    });
  });
});
