import { describe, expect, it, afterEach } from "vitest";
import {
  validateMapBbox,
  propertyWhereInBbox,
  nearbyPrefilterDegrees,
  DEFAULT_MAP_VIEWPORT_MAX_AREA_KM2,
} from "./mapQuery";

describe("validateMapBbox", () => {
  afterEach(() => {
    delete process.env.MAP_VIEWPORT_MAX_AREA_KM2;
  });

  it("requires bbox", () => {
    const r = validateMapBbox(null);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("BBOX_REQUIRED");
  });

  it("rejects invalid bbox", () => {
    const r = validateMapBbox("not-a-bbox");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("BBOX_INVALID");
  });

  it("accepts a city-scale bbox", () => {
    const r = validateMapBbox("51.39,5.42,51.49,5.52");
    expect(r.ok).toBe(true);
  });

  it("rejects oversized bbox", () => {
    process.env.MAP_VIEWPORT_MAX_AREA_KM2 = "1000";
    const r = validateMapBbox("50.0,3.0,54.0,8.0"); // Benelux-scale
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe("BBOX_TOO_LARGE");
      expect(r.maxAreaKm2).toBe(1000);
    }
  });

  it("can skip area check for region-scoped admin queries", () => {
    const r = validateMapBbox("50.0,3.0,54.0,8.0", { skipAreaCheck: true });
    expect(r.ok).toBe(true);
  });

  it("defaults max area constant", () => {
    expect(DEFAULT_MAP_VIEWPORT_MAX_AREA_KM2).toBeGreaterThan(10_000);
  });
});

describe("propertyWhereInBbox", () => {
  it("builds inclusive lat/lon ranges", () => {
    const w = propertyWhereInBbox([51.4, 5.4, 51.5, 5.5]);
    expect(w.lat).toEqual({ gte: 51.4, lte: 51.5 });
    expect(w.lon).toEqual({ gte: 5.4, lte: 5.5 });
  });
});

describe("nearbyPrefilterDegrees", () => {
  it("returns positive deltas", () => {
    const { dLat, dLon } = nearbyPrefilterDegrees(51.4, 2);
    expect(dLat).toBeGreaterThan(0);
    expect(dLon).toBeGreaterThan(0);
  });
});
