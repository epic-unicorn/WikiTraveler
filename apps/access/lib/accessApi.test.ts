import { describe, expect, it } from "vitest";
import { buildSearchParams, invalidateMapPins } from "../app/lib/accessApi";
import { readClientCache, writeClientCache } from "../app/lib/clientCache";
import { EMPTY_FILTERS } from "@wikitraveler/ui";
import {
  getDiscoveryViewMode,
  pinsFromSummaries,
  propertySummaryToMapPin,
} from "../app/lib/discoveryUtils";
import { groupFactsBySection, photosForFact } from "../app/lib/propertyFacts";

describe("buildSearchParams", () => {
  it("includes trimmed query", () => {
    const params = buildSearchParams("  hotel  ", EMPTY_FILTERS);
    expect(params.get("q")).toBe("hotel");
  });

  it("serializes feature and audited filters", () => {
    const params = buildSearchParams("", {
      ...EMPTY_FILTERS,
      features: ["step_free", "elevator"],
      audited: true,
      location: " Amsterdam ",
    });
    expect(params.get("feature")).toBe("step_free,elevator");
    expect(params.get("audited")).toBe("true");
    expect(params.get("location")).toBe("Amsterdam");
  });

  it("includes hasAccessibleRoom when enabled", () => {
    const params = buildSearchParams("", {
      ...EMPTY_FILTERS,
      hasAccessibleRoom: true,
    });
    expect(params.get("hasAccessibleRoom")).toBe("true");
  });
});

describe("invalidateMapPins", () => {
  it("drops cached pins for a node URL", () => {
    writeClientCache("map-pins:http://localhost:3000", [{ id: "p1" }]);
    invalidateMapPins("http://localhost:3000");
    expect(readClientCache("map-pins:http://localhost:3000")).toBeNull();
  });
});

describe("discoveryUtils", () => {
  it("converts property summaries to map pins", () => {
    const pin = propertySummaryToMapPin({
      id: "p1",
      name: "Hotel",
      location: "Rotterdam",
      lat: 51.9,
      lon: 4.5,
      facts: [{ fieldName: "step_free_entrance", value: "yes", tier: "VERIFIED" }],
    });
    expect(pin.id).toBe("p1");
    expect(pin.audited).toBe(true);
    expect(pin.lat).toBe(51.9);
  });

  it("filters unmappable summaries", () => {
    const pins = pinsFromSummaries([
      { id: "a", name: "A", location: "X", lat: 1, lon: 2 },
      { id: "b", name: "B", location: "Y", lat: null, lon: null },
    ]);
    expect(pins).toHaveLength(1);
    expect(pins[0].id).toBe("a");
  });

  it("defaults discovery view mode to map", () => {
    const original = global.sessionStorage;
    const store = new Map<string, string>();
    Object.defineProperty(global, "sessionStorage", {
      value: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => store.set(k, v),
      },
      configurable: true,
    });
    expect(getDiscoveryViewMode()).toBe("map");
    Object.defineProperty(global, "sessionStorage", { value: original, configurable: true });
  });
});

describe("propertyFacts", () => {
  it("groups facts into sections", () => {
    const sections = groupFactsBySection([
      { fieldName: "step_free_entrance", value: "yes", tier: "VERIFIED" },
      { fieldName: "accessible_bathroom", value: "yes", tier: "OFFICIAL" },
      { fieldName: "custom_field", value: "x", tier: "OFFICIAL" },
    ]);
    expect(sections.map((s) => s.id)).toEqual(["entrance", "bathroom", "other"]);
  });

  it("matches audit photos to facts", () => {
    const matched = photosForFact(
      [
        {
          url: "https://example.com/1.jpg",
          fieldName: "step_free_entrance",
          scopeKey: null,
          caption: "Entrance",
        },
      ],
      { fieldName: "step_free_entrance", value: "yes", tier: "VERIFIED" }
    );
    expect(matched).toHaveLength(1);
    expect(matched[0].url).toContain("1.jpg");
  });
});
