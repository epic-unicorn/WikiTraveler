import { describe, expect, it } from "vitest";
import { getGeofabrikRegion, GEOFABRIK_REGIONS } from "./geofabrik";
import {
  findPresetByBbox,
  listRegionPresets,
  listRegionPresetsByContinent,
  listRegionPresetsByTier,
  REGION_CONTINENT_ORDER,
  REGION_PRESETS,
  REGION_PRESET_TIER_LABELS,
  resolveRegionDisplayLabel,
  validateRegionBbox,
  type RegionContinent,
} from "./regionPresets";
import { validateBbox } from "./bbox";

describe("listRegionPresets", () => {
  it("only includes Overpass presets within the tile limit", () => {
    for (const preset of listRegionPresets()) {
      if (preset.geofabrikId || preset.offlineOnly) continue;
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
    expect(cities).toContain("tokyo");
    expect(cities).toContain("sao-paulo");
    expect(cities).toContain("cape-town");
    expect(cities).toContain("sydney");
    expect(cities).toContain("new-york-city");
    expect(cities).not.toContain("rotterdam");

    expect(countries).toContain("belgium");
    expect(countries).toContain("costa-rica");
    expect(countries).toContain("rwanda");
    expect(countries).not.toContain("netherlands");

    expect(regions).toContain("benelux");
    expect(regions).toContain("east-africa-rift");

    expect(geofabrik).toContain("france");
    expect(geofabrik).toContain("germany");
    expect(geofabrik).toContain("netherlands");
    expect(geofabrik).toContain("japan");
    expect(geofabrik).toContain("us-california");
    expect(geofabrik).toContain("brazil");
    expect(geofabrik).toContain("australia");
  });

  it("covers every world continent with at least one city and one larger preset", () => {
    for (const continent of REGION_CONTINENT_ORDER) {
      const cities = listRegionPresetsByContinent(continent).filter((p) => p.tier === "city");
      const larger = listRegionPresetsByContinent(continent).filter(
        (p) => p.tier === "country" || p.tier === "geofabrik" || p.tier === "region"
      );
      expect(cities.length, `${continent} cities`).toBeGreaterThan(0);
      expect(larger.length, `${continent} larger presets`).toBeGreaterThan(0);
    }
  });

  it("requires continent on every catalog entry", () => {
    for (const preset of REGION_PRESETS) {
      expect(REGION_CONTINENT_ORDER).toContain(preset.continent);
    }
  });

  it("links every geofabrikId to the Geofabrik download catalog", () => {
    for (const preset of REGION_PRESETS) {
      if (!preset.geofabrikId) continue;
      const region = getGeofabrikRegion(preset.geofabrikId);
      expect(region, preset.id).toBeDefined();
      expect(region!.continent).toBe(preset.continent);
      expect(region!.url).toMatch(/^https:\/\/download\.geofabrik\.de\//);
      expect(region!.url).toMatch(/-latest\.osm\.pbf$/);
    }
  });

  it("keeps Geofabrik extracts outside the europe/ path for non-Europe continents", () => {
    const byContinent: Record<RegionContinent, string[]> = {
      europe: [],
      "north-america": [],
      "south-america": [],
      asia: [],
      africa: [],
      oceania: [],
    };
    for (const region of GEOFABRIK_REGIONS) {
      byContinent[region.continent].push(region.url);
    }
    expect(byContinent.europe.every((u) => u.includes("/europe/"))).toBe(true);
    expect(byContinent["north-america"].some((u) => u.includes("/north-america/"))).toBe(true);
    expect(byContinent["south-america"].some((u) => u.includes("/south-america/"))).toBe(true);
    expect(byContinent.asia.some((u) => u.includes("/asia/"))).toBe(true);
    expect(byContinent.africa.some((u) => u.includes("/africa/"))).toBe(true);
    expect(byContinent.oceania.some((u) => u.includes("/australia-oceania/"))).toBe(true);
  });

  it("validates geofabrik presets without tile cap", () => {
    const result = validateRegionBbox("41.33,-5.14,51.09,9.56", "france");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.ingestMode).toBe("geofabrik");
      expect(result.geofabrikId).toBe("france");
    }

    const tokyoState = validateRegionBbox("32.5,-124.5,42.0,-114.1", "us-california");
    expect(tokyoState.ok).toBe(true);
    if (tokyoState.ok) {
      expect(tokyoState.ingestMode).toBe("geofabrik");
      expect(tokyoState.geofabrikId).toBe("us-california");
    }
  });

  it("exposes tier labels for the admin UI", () => {
    expect(REGION_PRESET_TIER_LABELS.geofabrik).toContain("Geofabrik");
  });
});

describe("country preset tile budgets", () => {
  it("routes Netherlands through Geofabrik (no Overpass tile cap)", () => {
    const nl = REGION_PRESETS.find((p) => p.id === "netherlands")!;
    expect(nl.geofabrikId).toBe("netherlands");
    const result = validateRegionBbox(nl.bbox, "netherlands");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.ingestMode).toBe("geofabrik");
      expect(result.tileCount).toBe(0);
    }
  });

  it("marks Benelux as offline-only (CLI, no Admin tile cap)", () => {
    const benelux = REGION_PRESETS.find((p) => p.id === "benelux")!;
    expect(benelux.offlineOnly).toBe(true);
    const result = validateRegionBbox(benelux.bbox, "benelux");
    expect(result.ok).toBe(true);
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

  it("resolves global city presets by id", () => {
    expect(resolveRegionDisplayLabel(null, "tokyo", null)).toBe("Tokyo");
    expect(resolveRegionDisplayLabel(null, "cape-town", null)).toBe("Cape Town");
  });
});
