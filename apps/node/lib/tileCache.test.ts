import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import {
  clearJobTileCache,
  loadCachedTile,
  saveCachedTile,
  tileCachePath,
} from "./tileCache";

const TEST_ROOT = join(process.cwd(), ".cache", "osm-tiles-test");

describe("tileCache", () => {
  beforeEach(() => {
    process.env.OSM_TILE_CACHE_DIR = TEST_ROOT;
    mkdirSync(TEST_ROOT, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TEST_ROOT)) rmSync(TEST_ROOT, { recursive: true, force: true });
    delete process.env.OSM_TILE_CACHE_DIR;
  });

  it("saves and loads cached tile JSON", () => {
    const path = tileCachePath("job-1", 0);
    const payload = { elements: [{ type: "node", id: 1, lat: 1, lon: 2, tags: {} }] };
    saveCachedTile(path, payload);
    expect(loadCachedTile(path)).toEqual(payload);
  });

  it("returns null for missing cache", () => {
    expect(loadCachedTile(join(TEST_ROOT, "missing.json"))).toBeNull();
  });

  it("clears job cache directory", () => {
    const path = tileCachePath("job-2", 3);
    writeFileSync(path, "{}");
    expect(existsSync(join(TEST_ROOT, "job-2"))).toBe(true);
    clearJobTileCache("job-2");
    expect(existsSync(join(TEST_ROOT, "job-2"))).toBe(false);
  });
});
