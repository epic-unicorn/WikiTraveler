import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Bbox } from "./bbox";

vi.mock("@/lib/overpass", () => ({
  fetchOverpassCount: vi.fn(),
}));

import { fetchOverpassCount } from "@/lib/overpass";
import { buildIngestTiles, getTileElementMax, refineTilesByElementCount } from "./tileRefine";

const smallBbox: Bbox = [51.4, 5.4, 51.5, 5.5];

describe("getTileElementMax", () => {
  it("defaults to 4000", () => {
    delete process.env.OSM_TILE_ELEMENT_MAX;
    expect(getTileElementMax()).toBe(4000);
  });

  it("reads OSM_TILE_ELEMENT_MAX", () => {
    process.env.OSM_TILE_ELEMENT_MAX = "2000";
    expect(getTileElementMax()).toBe(2000);
    delete process.env.OSM_TILE_ELEMENT_MAX;
  });
});

describe("refineTilesByElementCount", () => {
  beforeEach(() => {
    vi.mocked(fetchOverpassCount).mockReset();
    delete process.env.OSM_TILE_ELEMENT_MAX;
  });

  it("keeps tiles under the element cap", async () => {
    vi.mocked(fetchOverpassCount).mockResolvedValue(500);
    const refined = await refineTilesByElementCount([smallBbox]);
    expect(refined).toHaveLength(1);
    expect(refined[0]).toEqual(smallBbox);
  });

  it("bisects tiles over the element cap", async () => {
    vi.mocked(fetchOverpassCount).mockImplementation(async (bbox: string) => {
      if (bbox.includes("51.45")) return 100;
      return 8000;
    });
    const refined = await refineTilesByElementCount([smallBbox]);
    expect(refined.length).toBeGreaterThan(1);
  });
});

describe("buildIngestTiles", () => {
  beforeEach(() => {
    vi.mocked(fetchOverpassCount).mockReset();
    delete process.env.OSM_TILE_REFINE;
  });

  it("skips refinement when tile count exceeds warn limit", async () => {
    const benelux: Bbox = [49.4, 2.5, 53.55, 7.23];
    vi.mocked(fetchOverpassCount).mockResolvedValue(99999);
    const tiles = await buildIngestTiles(benelux);
    expect(fetchOverpassCount).not.toHaveBeenCalled();
    expect(tiles.length).toBeGreaterThan(40);
  });

  it("skips refinement when OSM_TILE_REFINE=0", async () => {
    process.env.OSM_TILE_REFINE = "0";
    vi.mocked(fetchOverpassCount).mockResolvedValue(99999);
    const tiles = await buildIngestTiles(smallBbox);
    expect(fetchOverpassCount).not.toHaveBeenCalled();
    expect(tiles.length).toBeGreaterThanOrEqual(1);
  });
});
