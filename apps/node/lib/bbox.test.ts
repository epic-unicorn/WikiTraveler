import { describe, expect, it } from "vitest";
import {
  bboxAreaKm2,
  bboxOverlapRatio,
  classifyBboxChange,
  containsPoint,
  formatBbox,
  getTileMaxLimit,
  isExpand,
  isShrink,
  parseBbox,
  planTileIngest,
  splitBboxIntoTiles,
  TILE_MAX_AREA_KM2,
  validateBbox,
} from "./bbox";

const EINDHOVEN: [number, number, number, number] = [51.39, 5.42, 51.49, 5.52];
const NETHERLANDS: [number, number, number, number] = [50.75, 3.36, 53.55, 7.23];

describe("parseBbox / formatBbox", () => {
  it("round-trips a valid bbox string", () => {
    const b = parseBbox("51.39,5.42,51.49,5.52");
    expect(b).toEqual(EINDHOVEN);
    expect(formatBbox(EINDHOVEN)).toBe("51.39,5.42,51.49,5.52");
  });

  it("rejects invalid strings", () => {
    expect(parseBbox(null)).toBeNull();
    expect(parseBbox("1,2,3")).toBeNull();
    expect(parseBbox("51.5,5.4,51.4,5.5")).toBeNull();
  });
});

describe("containsPoint", () => {
  it("returns true inside bbox", () => {
    expect(containsPoint(EINDHOVEN, 51.44, 5.47)).toBe(true);
  });

  it("returns false outside bbox", () => {
    expect(containsPoint(EINDHOVEN, 52.3, 5.3)).toBe(false);
  });
});

describe("classifyBboxChange", () => {
  it("detects initial setup when no current bbox", () => {
    expect(classifyBboxChange(null, EINDHOVEN)).toBe("initial");
  });

  it("detects shrink, expand, and move", () => {
    const inner: [number, number, number, number] = [51.41, 5.44, 51.47, 5.5];
    const outer: [number, number, number, number] = [51.35, 5.38, 51.53, 5.56];
    expect(classifyBboxChange(EINDHOVEN, inner)).toBe("shrink");
    expect(classifyBboxChange(EINDHOVEN, outer)).toBe("expand");
    expect(classifyBboxChange(EINDHOVEN, [52.0, 6.0, 52.1, 6.1])).toBe("move");
  });

  it("detects unchanged bbox", () => {
    expect(classifyBboxChange(EINDHOVEN, EINDHOVEN)).toBe("unchanged");
  });
});

describe("isShrink / isExpand", () => {
  it("classifies containment correctly", () => {
    const inner: [number, number, number, number] = [51.41, 5.44, 51.47, 5.5];
    expect(isShrink(EINDHOVEN, inner)).toBe(true);
    expect(isExpand(EINDHOVEN, inner)).toBe(false);
  });
});

describe("splitBboxIntoTiles", () => {
  it("returns a single tile for small regions", () => {
    const tiles = splitBboxIntoTiles(EINDHOVEN);
    expect(tiles).toHaveLength(1);
    expect(tiles[0]).toEqual(EINDHOVEN);
  });

  it("splits Netherlands into multiple safe tiles", () => {
    const tiles = splitBboxIntoTiles(NETHERLANDS);
    expect(tiles.length).toBeGreaterThan(1);
    expect(tiles.length).toBeLessThanOrEqual(getTileMaxLimit());
    for (const tile of tiles) {
      expect(bboxAreaKm2(tile)).toBeLessThanOrEqual(TILE_MAX_AREA_KM2);
    }
  });
});

describe("validateBbox", () => {
  it("accepts Eindhoven lab bbox", () => {
    const result = validateBbox(formatBbox(EINDHOVEN));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.tileCount).toBe(1);
  });

  it("accepts Netherlands with tiled ingest", () => {
    const result = validateBbox(formatBbox(NETHERLANDS));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.tileCount).toBeGreaterThan(1);
      expect(result.warnLarge).toBe(true);
    }
  });
});

describe("planTileIngest", () => {
  it("estimates duration from tile count", () => {
    const plan = planTileIngest(NETHERLANDS);
    expect(plan.estimatedDurationSec).toBe(plan.tileCount * 48);
  });
});

describe("bboxOverlapRatio", () => {
  it("returns 1 for identical bboxes", () => {
    expect(bboxOverlapRatio(EINDHOVEN, EINDHOVEN)).toBeCloseTo(1, 5);
  });

  it("returns 0 for disjoint bboxes", () => {
    expect(bboxOverlapRatio(EINDHOVEN, [52.0, 6.0, 52.1, 6.1])).toBe(0);
  });
});

describe("bboxAreaKm2", () => {
  it("returns positive area for valid bbox", () => {
    expect(bboxAreaKm2(EINDHOVEN)).toBeGreaterThan(0);
    expect(bboxAreaKm2(EINDHOVEN)).toBeLessThan(TILE_MAX_AREA_KM2);
  });
});
