import { describe, it, expect } from "vitest";
import {
  ACCESS_HUB_URL,
  DEFAULT_NODE_URL,
  ONBOARDING_KEY,
  CATEGORY_EXPECTED,
  FEATURE_HIGHLIGHTS,
  truthyFactValue,
  computeCategoryBars,
  overallAccessibilityScore,
  scoreFromFacts,
  propertyViewUrl,
  isAllowedNodeUrl,
  extractHotelNameFromTitle,
  featurePresence,
  normalizeHotelName,
  hotelNamesLooselyEqual,
  pickBestPropertyMatch,
  buildHotelSearchQueries,
} from "./lensLogic.js";

describe("Lens defaults", () => {
  it("uses the EU production node as default home", () => {
    expect(DEFAULT_NODE_URL).toBe("https://node-eu.wikitraveler.org");
  });

  it("points Access hub and onboarding storage key", () => {
    expect(ACCESS_HUB_URL).toBe("https://access.wikitraveler.org");
    expect(ONBOARDING_KEY).toBe("lensOnboardingDone");
  });

  it("exposes four score categories and four feature highlights", () => {
    expect(CATEGORY_EXPECTED).toHaveLength(4);
    expect(FEATURE_HIGHLIGHTS).toEqual([
      "step_free_entrance",
      "accessible_bathroom",
      "elevator_present",
      "parking_accessible",
    ]);
  });
});

describe("truthyFactValue", () => {
  it("treats empty / negative tokens as absent", () => {
    expect(truthyFactValue("")).toBe(false);
    expect(truthyFactValue(null)).toBe(false);
    expect(truthyFactValue("no")).toBe(false);
    expect(truthyFactValue("N/A")).toBe(false);
    expect(truthyFactValue("false")).toBe(false);
    expect(truthyFactValue("0")).toBe(false);
  });

  it("treats yes / measurements as present", () => {
    expect(truthyFactValue("yes")).toBe(true);
    expect(truthyFactValue("partial")).toBe(true);
    expect(truthyFactValue("90")).toBe(true);
    expect(truthyFactValue("step_free")).toBe(true);
  });
});

describe("accessibility score", () => {
  it("returns null when there are no facts", () => {
    const { bars, score } = scoreFromFacts([]);
    expect(score).toBeNull();
    expect(bars.every((b) => b.pct === 0)).toBe(true);
  });

  it("caps category coverage at 100% and weights overall score", () => {
    const facts = [
      { fieldName: "step_free_entrance", value: "yes" },
      { fieldName: "automatic_door", value: "yes" },
      { fieldName: "ramp_present", value: "yes" },
      { fieldName: "door_width_cm", value: "90" },
      { fieldName: "path_to_entrance", value: "step_free" },
      { fieldName: "elevator_present", value: "yes" },
      { fieldName: "elevator_width_cm", value: "110" },
      { fieldName: "corridor_min_width_cm", value: "120" },
      { fieldName: "parking_accessible", value: "yes" },
      { fieldName: "pool_lift", value: "no" },
      { fieldName: "accessible_bathroom", value: "yes" },
      { fieldName: "roll_in_shower", value: "yes" },
      { fieldName: "grab_bars_bathroom", value: "yes" },
      { fieldName: "hearing_loop", value: "yes" },
    ];
    const bars = computeCategoryBars(facts);
    const mobility = bars.find((b) => b.id === "mobility");
    const bathroom = bars.find((b) => b.id === "bathroom");
    expect(mobility.count).toBe(10); // 5 entrance + 5 mobility fields
    expect(mobility.pct).toBe(Math.min(100, Math.round((10 / 11) * 100)));
    expect(bathroom.pct).toBe(100);

    const score = overallAccessibilityScore(bars);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("ignores unknown field names", () => {
    const bars = computeCategoryBars([{ fieldName: "notes", value: "hi" }]);
    expect(bars.every((b) => b.count === 0)).toBe(true);
    expect(overallAccessibilityScore(bars)).toBeNull();
  });
});

describe("featurePresence", () => {
  it("marks features present only for truthy values", () => {
    const result = featurePresence([
      { fieldName: "step_free_entrance", value: "yes" },
      { fieldName: "elevator_present", value: "no" },
    ]);
    expect(result.find((r) => r.fieldName === "step_free_entrance").present).toBe(true);
    expect(result.find((r) => r.fieldName === "elevator_present").present).toBe(false);
    expect(result.find((r) => r.fieldName === "accessible_bathroom").present).toBe(false);
  });
});

describe("propertyViewUrl", () => {
  it("builds an Access deep link with node query", () => {
    expect(propertyViewUrl("https://node-eu.wikitraveler.org", "prop-1")).toBe(
      "https://access.wikitraveler.org/properties/prop-1?node=https%3A%2F%2Fnode-eu.wikitraveler.org"
    );
  });

  it("encodes special characters in the property id", () => {
    expect(propertyViewUrl("https://node.example", "a/b")).toContain("a%2Fb");
  });
});

describe("isAllowedNodeUrl", () => {
  it("allows http(s) node URLs only", () => {
    expect(isAllowedNodeUrl("https://node-eu.wikitraveler.org")).toBe(true);
    expect(isAllowedNodeUrl("http://localhost:3000")).toBe(true);
    expect(isAllowedNodeUrl("ftp://evil")).toBe(false);
    expect(isAllowedNodeUrl("not-a-url")).toBe(false);
    expect(isAllowedNodeUrl("")).toBe(false);
  });
});

describe("extractHotelNameFromTitle", () => {
  it("strips Booking.com and trailing city suffixes", () => {
    expect(extractHotelNameFromTitle("The Match | Booking.com")).toBe("The Match");
    expect(extractHotelNameFromTitle("Hotel Foo – Expedia")).toBe("Hotel Foo");
    expect(extractHotelNameFromTitle("Grand Hotel, Amsterdam")).toBe("Grand Hotel");
  });
});

describe("hotel name fuzzy match", () => {
  it("normalizes Hotel the Match to the same core as The Match", () => {
    expect(normalizeHotelName("Hotel the Match")).toBe("match");
    expect(normalizeHotelName("The Match")).toBe("match");
    expect(hotelNamesLooselyEqual("Hotel the Match", "The Match")).toBe(true);
  });

  it("picks The Match from mixed search hits for Hotel the Match", () => {
    const picked = pickBestPropertyMatch("Hotel the Match", [
      { id: "1", name: "Matchroom Country Club" },
      { id: "2", name: "The Match" },
    ]);
    expect(picked?.id).toBe("2");
  });

  it("does not treat Matchroom as a match for Hotel the Match", () => {
    expect(hotelNamesLooselyEqual("Hotel the Match", "Matchroom Country Club")).toBe(false);
    const picked = pickBestPropertyMatch("Hotel the Match", [
      { id: "1", name: "Matchroom Country Club" },
    ]);
    expect(picked).toBeNull();
  });
});
