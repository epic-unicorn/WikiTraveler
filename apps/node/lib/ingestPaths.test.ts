import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Bbox } from "@/lib/bbox";
import { createIngestPrismaMock } from "@/lib/test/prismaIngestMock";

const EINDHOVEN_BBOX: Bbox = [51.39, 5.42, 51.49, 5.52];
const FIXTURES = join(__dirname, "..", "test-fixtures");

describe("Overpass ingest path", () => {
  it("ingests accommodation properties from an Overpass JSON fixture", async () => {
    const { prisma, properties, facts } = createIngestPrismaMock();
    const { ingestOverpassResult } = await import("@/lib/overpass");

    const raw = readFileSync(join(FIXTURES, "overpass-eindhoven-snippet.json"), "utf-8");
    const result = JSON.parse(raw) as { elements: unknown[] };

    const stats = await ingestOverpassResult(
      result as Parameters<typeof ingestOverpassResult>[0],
      "test-node:osm",
      prisma
    );

    expect(stats.total).toBe(2);
    expect(stats.created).toBe(2);
    expect(properties).toHaveLength(2);
    expect(properties.map((p) => p.name)).toContain("Pullman Eindhoven Cocagne");
    expect(facts.some((f) => f.fieldName === "step_free_entrance")).toBe(true);
  });
});

describe("GeoJSON ingest path", () => {
  it("importGeoJsonFile ingests from a geojsonseq fixture clipped to bbox", async () => {
    const { prisma, properties } = createIngestPrismaMock();
    const { importGeoJsonFile } = await import("@/lib/pbfImport");

    const { elements, stats } = await importGeoJsonFile(
      join(FIXTURES, "accommodation.geojsonseq"),
      EINDHOVEN_BBOX,
      "test-node:osm",
      prisma
    );

    expect(elements).toBe(2);
    expect(stats.created).toBe(2);
    expect(properties).toHaveLength(2);
  });

  it("ingestGeoJsonSeqFile streams geojsonseq line by line", async () => {
    const { prisma, properties } = createIngestPrismaMock();
    const { ingestGeoJsonSeqFile } = await import("@/lib/pbfImport");

    const stats = await ingestGeoJsonSeqFile(
      join(FIXTURES, "accommodation.geojsonseq"),
      EINDHOVEN_BBOX,
      "test-node:osm",
      prisma
    );

    expect(stats.total).toBe(2);
    expect(stats.created).toBe(2);
    expect(properties).toHaveLength(2);
  });
});

describe("Geofabrik ingest path", () => {
  it("importGeofabrikRegion delegates to geojsonseq ingest when geojsonPath is provided", async () => {
    const { prisma, properties } = createIngestPrismaMock();
    const { importGeofabrikRegion } = await import("@/lib/pbfImport");

    const { elements, stats } = await importGeofabrikRegion({
      geofabrikId: "france",
      bbox: EINDHOVEN_BBOX,
      sourceNodeId: "test-node:osm",
      prisma,
      geojsonPath: join(FIXTURES, "accommodation.geojsonseq"),
    });

    expect(elements).toBe(2);
    expect(stats.created).toBe(2);
    expect(properties).toHaveLength(2);
  });
});
