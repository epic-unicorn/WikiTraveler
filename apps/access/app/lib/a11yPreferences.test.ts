import { describe, expect, it } from "vitest";
import {
  extrasFromFeatures,
  featuresFromPrefs,
  hasExplicitSearch,
  overridesFromFeatures,
} from "./a11yPreferences";

describe("featuresFromPrefs", () => {
  it("applies prefs then extras, skipping overridden keys", () => {
    expect(
      featuresFromPrefs(
        ["ramp_present", "elevator_present"],
        ["hearing_loop"],
        ["elevator_present"]
      )
    ).toEqual(["ramp_present", "hearing_loop"]);
  });
});

describe("overridesFromFeatures", () => {
  it("treats missing pref keys as session overrides", () => {
    expect(
      overridesFromFeatures(["ramp_present"], ["ramp_present", "elevator_present"])
    ).toEqual(["elevator_present"]);
  });
});

describe("extrasFromFeatures", () => {
  it("keeps search-only filters that are not profile prefs", () => {
    expect(
      extrasFromFeatures(["ramp_present", "automatic_door"], ["ramp_present"])
    ).toEqual(["automatic_door"]);
  });
});

describe("hasExplicitSearch", () => {
  const emptyFilters = {
    features: [] as string[],
    audited: null as boolean | null,
    hasAccessibleRoom: false,
  };

  it("treats profile chips alone as browse, not a typed search", () => {
    expect(
      hasExplicitSearch("", { ...emptyFilters, features: ["ramp_present"] }, ["ramp_present"])
    ).toBe(false);
  });

  it("treats extra funnel features, query, audited, or accessible-room as a search", () => {
    expect(
      hasExplicitSearch("", { ...emptyFilters, features: ["ramp_present", "automatic_door"] }, [
        "ramp_present",
      ])
    ).toBe(true);
    expect(hasExplicitSearch("hotel", emptyFilters, ["ramp_present"])).toBe(true);
    expect(hasExplicitSearch("", { ...emptyFilters, audited: true }, [])).toBe(true);
    expect(hasExplicitSearch("", { ...emptyFilters, hasAccessibleRoom: true }, [])).toBe(true);
    expect(hasExplicitSearch("", { ...emptyFilters, hasAccessibleRoom: null }, [])).toBe(false);
  });
});
