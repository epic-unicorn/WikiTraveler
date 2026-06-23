import { describe, expect, it } from "vitest";
import { planTileIngest, validateBbox } from "./bbox";
import {
  findPresetByBbox,
  listRegionPresets,
  listRegionPresetsByTier,
  REGION_PRESETS,
  REGION_PRESET_TIER_LABELS,
  resolveRegionDisplayLabel,
  validateRegionBbox,
} from "./regionPresets";

describe("listRegionPresets", () => {
  it("only includes Overpass presets within the tile limit", () => {
    for (const preset of listRegionPresets()) {
      if (preset.geofabrikId) continue;
      expect(validateBbox(preset.bbox).ok).toBe(true);
    }
    expect(listRegionPresets().length).toBe(REGION_PRESETS.length);
  });

  it("groups cities, countries, regions, and geofabrik", () => {
    const cities = listRegionPresetsByTier("city").map((p) => p.id);
    const countries = listRegionPresetsByTier("country").map((p) => p.id);
    const regions = listRegionPresetsByTier("region").map((p) => p.id);
    const geofabrik = listRegionPresetsByTier("geofabrik").map((p) => p.id);

    expect(cities).toContain("amsterdam");
    expect(cities).not.toContain("rotterdam");

    expect(countries).toContain("netherlands");
    expect(countries).toContain("belgium");

    expect(regions).toContain("benelux");

    expect(geofabrik).toContain("france");
    expect(geofabrik).toContain("germany");
  });

  it("validates geofabrik presets without tile cap", () => {
    const result = validateRegionBbox("41.33,-5.14,51.09,9.56", "france");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.ingestMode).toBe("geofabrik");
      expect(result.geofabrikId).toBe("france");
    }
  });

  it("exposes tier labels for the admin UI", () => {
    expect(REGION_PRESET_TIER_LABELS.geofabrik).toContain("Geofabrik");
  });
});

describe("country preset tile budgets", () => {
  it("keeps Netherlands under the default tile cap", () => {
    const nl = REGION_PRESETS.find((p) => p.id === "netherlands")!;
    const plan = planTileIngest(nl.bbox.split(",").map(Number) as [number, number, number, number]);
    expect(plan.tileCount).toBeLessThanOrEqual(150);
    expect(plan.warnLarge).toBe(true);
  });

  it("keeps Benelux under the default tile cap", () => {
    const benelux = REGION_PRESETS.find((p) => p.id === "benelux")!;
    const plan = planTileIngest(benelux.bbox.split(",").map(Number) as [number, number, number, number]);
    expect(plan.tileCount).toBeLessThanOrEqual(150);
  });
});

describe("findPresetByBbox", () => {
  it("matches Benelux when coordinates use fewer decimals", () => {
    const matched = findPresetByBbox("49.4,2.5,53.55,7.23");
    expect(matched?.id).toBe("benelux");
    expect(resolveRegionDisplayLabel("Ulicoten, Noord-Brabant", null, "49.4,2.5,53.55,7.23")).toBe(
      "Benelux"
    );
  });

  it("prefers explicit presetId over bbox inference", () => {
    expect(resolveRegionDisplayLabel("Wrong name", "netherlands", "49.4,2.5,53.55,7.23")).toBe(
      "Netherlands"
    );
  });
});
