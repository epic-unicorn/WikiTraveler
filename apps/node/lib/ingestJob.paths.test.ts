import { readFileSync } from "fs";
import { join } from "path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  prismaMock,
  fetchTileOverpassData,
  importGeofabrikRegion,
  importGeoJsonFile,
  ingestOverpassResult,
  commitNodeBbox,
  recordIngestComplete,
  deriveRegionLabel,
  purgeOutsideBbox,
  purgeGossipOutsideBbox,
} = vi.hoisted(() => ({
  prismaMock: {
    ingestJob: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    ingestJobTile: {
      update: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
    },
  },
  fetchTileOverpassData: vi.fn(),
  importGeofabrikRegion: vi.fn(),
  importGeoJsonFile: vi.fn(),
  ingestOverpassResult: vi.fn(),
  commitNodeBbox: vi.fn(),
  recordIngestComplete: vi.fn(),
  deriveRegionLabel: vi.fn(),
  purgeOutsideBbox: vi.fn(),
  purgeGossipOutsideBbox: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/tileCache", () => ({ fetchTileOverpassData, clearJobTileCache: vi.fn() }));
vi.mock("@/lib/pbfImport", () => ({ importGeofabrikRegion, importGeoJsonFile }));
vi.mock("@/lib/overpass", () => ({ ingestOverpassResult }));
vi.mock("@/lib/nodeSettings", () => ({ commitNodeBbox, recordIngestComplete }));
vi.mock("@/lib/geocode", () => ({ deriveRegionLabel }));
vi.mock("@/lib/regionPurge", () => ({ purgeOutsideBbox, purgeGossipOutsideBbox }));

import { processIngestJob } from "@/lib/ingestJob";

const BBOX = "51.39,5.42,51.49,5.52";
const FIXTURES = join(__dirname, "..", "test-fixtures");

function overpassFixture() {
  return JSON.parse(readFileSync(join(FIXTURES, "overpass-eindhoven-snippet.json"), "utf-8"));
}

describe("processIngestJob — ingest paths", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    deriveRegionLabel.mockResolvedValue("Eindhoven");
    purgeOutsideBbox.mockResolvedValue(0);
    purgeGossipOutsideBbox.mockResolvedValue(0);
    commitNodeBbox.mockResolvedValue({});
    recordIngestComplete.mockResolvedValue(undefined);
    prismaMock.ingestJob.update.mockResolvedValue({});
    prismaMock.ingestJobTile.update.mockResolvedValue({});
    prismaMock.ingestJobTile.count.mockResolvedValue(0);
    process.env.OSM_INGEST_MODE = "continuous";
    delete process.env.VERCEL;
  });

  it("completes a single-tile Overpass job", async () => {
    const tile = {
      id: "tile-1",
      index: 0,
      bbox: BBOX,
      status: "PENDING",
    };
    prismaMock.ingestJob.findUnique.mockResolvedValue({
      id: "job-overpass",
      status: "PENDING",
      bbox: BBOX,
      changeType: "refresh",
      tileCount: 1,
      tilesDone: 0,
      tiles: [tile],
      stats: { purged: true },
      startedAt: null,
    });
    fetchTileOverpassData.mockResolvedValue(overpassFixture());
    ingestOverpassResult.mockResolvedValue({
      total: 2,
      created: 2,
      updated: 0,
      deduped: 0,
      skipped: 0,
    });

    await processIngestJob("job-overpass");

    expect(fetchTileOverpassData).toHaveBeenCalledWith("job-overpass", 0, BBOX);
    expect(prismaMock.ingestJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "job-overpass" },
        data: expect.objectContaining({ status: "COMPLETED", phase: "DONE" }),
      })
    );
    expect(recordIngestComplete).toHaveBeenCalled();
  });

  it("completes a geojson-import job", async () => {
    prismaMock.ingestJob.findUnique.mockResolvedValue({
      id: "job-geojson",
      status: "PENDING",
      bbox: BBOX,
      changeType: "geojson-import",
      tileCount: 0,
      tilesDone: 0,
      tiles: [],
      stats: { geojsonPath: "/tmp/test.geojsonseq", purged: false },
      startedAt: null,
    });
    importGeoJsonFile.mockResolvedValue({
      elements: 2,
      stats: { total: 2, created: 2, updated: 0, deduped: 0, skipped: 0 },
    });

    await processIngestJob("job-geojson");

    expect(importGeoJsonFile).toHaveBeenCalled();
    expect(prismaMock.ingestJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "job-geojson" },
        data: expect.objectContaining({
          status: "COMPLETED",
          message: expect.stringContaining("GeoJSON import complete"),
        }),
      })
    );
  });

  it("completes a pbf-import job", async () => {
    prismaMock.ingestJob.findUnique.mockResolvedValue({
      id: "job-pbf",
      status: "PENDING",
      bbox: BBOX,
      changeType: "pbf-import",
      tileCount: 0,
      tilesDone: 0,
      tiles: [],
      stats: { geofabrikId: "france", purged: false },
      startedAt: null,
    });
    importGeofabrikRegion.mockResolvedValue({
      elements: 100,
      stats: { total: 100, created: 80, updated: 20, deduped: 0, skipped: 0 },
    });

    await processIngestJob("job-pbf");

    expect(importGeofabrikRegion).toHaveBeenCalledWith(
      expect.objectContaining({ geofabrikId: "france" })
    );
    expect(prismaMock.ingestJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "job-pbf" },
        data: expect.objectContaining({
          status: "COMPLETED",
          message: expect.stringContaining("Geofabrik import complete"),
        }),
      })
    );
  });

  it("fails pbf-import on Vercel chunked mode", async () => {
    delete process.env.OSM_INGEST_MODE;
    process.env.VERCEL = "1";
    prismaMock.ingestJob.findUnique.mockResolvedValue({
      id: "job-pbf-fail",
      status: "PENDING",
      bbox: BBOX,
      changeType: "pbf-import",
      tileCount: 0,
      tilesDone: 0,
      tiles: [],
      stats: { geofabrikId: "france", purged: false },
      startedAt: null,
    });

    await processIngestJob("job-pbf-fail");

    expect(importGeofabrikRegion).not.toHaveBeenCalled();
    expect(prismaMock.ingestJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "job-pbf-fail" },
        data: expect.objectContaining({ status: "FAILED" }),
      })
    );
  });
});
