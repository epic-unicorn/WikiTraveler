import { describe, expect, it } from "vitest";
import { collapseMapFacts, MAP_PIN_LIMIT } from "./mapPinFacts";

describe("collapseMapFacts", () => {
  it("keeps highest tier per field", () => {
    const result = collapseMapFacts([
      { fieldName: "step_free", value: "false", tier: "OFFICIAL" },
      { fieldName: "step_free", value: "true", tier: "VERIFIED" },
    ]);
    expect(result.facts.step_free).toEqual({ value: "true", tier: "VERIFIED" });
    expect(result.audited).toBe(true);
  });

  it("is not audited when only official facts exist", () => {
    const result = collapseMapFacts([
      { fieldName: "step_free", value: "false", tier: "OFFICIAL" },
    ]);
    expect(result.audited).toBe(false);
  });

  it("marks audited when any fact is VERIFIED or CONFIRMED", () => {
    const result = collapseMapFacts([
      { fieldName: "a", value: "1", tier: "OFFICIAL" },
      { fieldName: "b", value: "2", tier: "CONFIRMED" },
    ]);
    expect(result.audited).toBe(true);
  });
});

describe("MAP_PIN_LIMIT", () => {
  it("is a positive safety cap", () => {
    expect(MAP_PIN_LIMIT).toBeGreaterThan(0);
  });
});
