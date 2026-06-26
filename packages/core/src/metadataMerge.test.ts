import { describe, expect, it } from "vitest";
import {
  mergeMetadataOverrides,
  resolveEffectiveMetadata,
} from "./metadataMerge";
import type { PropertyMetadataOverride } from "./types";

const base = {
  name: "OSM Hotel",
  location: "Main St 1",
  lat: 51.44,
  lon: 5.48,
};

function override(
  partial: Partial<PropertyMetadataOverride> & Pick<PropertyMetadataOverride, "fieldName" | "value">
): PropertyMetadataOverride {
  return {
    canonicalId: "osm:1",
    sourceType: "AUDITOR",
    sourceNodeId: "node-a",
    submittedBy: "admin",
    timestamp: "2026-06-26T10:00:00.000Z",
    signatureHash: null,
    clearedAt: null,
    ...partial,
  };
}

describe("resolveEffectiveMetadata", () => {
  it("returns base when no overrides", () => {
    expect(resolveEffectiveMetadata(base, [])).toEqual(base);
  });

  it("manual override beats base", () => {
    const effective = resolveEffectiveMetadata(base, [
      override({ fieldName: "name", value: "Corrected Hotel", sourceNodeId: "node-a" }),
    ]);
    expect(effective.name).toBe("Corrected Hotel");
    expect(effective.location).toBe(base.location);
  });

  it("newer peer override wins", () => {
    const effective = resolveEffectiveMetadata(base, [
      override({
        fieldName: "location",
        value: "Old fix",
        sourceNodeId: "node-a",
        timestamp: "2026-06-26T09:00:00.000Z",
      }),
      override({
        fieldName: "location",
        value: "Peer fix",
        sourceNodeId: "node-b",
        timestamp: "2026-06-26T11:00:00.000Z",
      }),
    ]);
    expect(effective.location).toBe("Peer fix");
  });

  it("tombstone suppresses override and falls back to base", () => {
    const effective = resolveEffectiveMetadata(base, [
      override({
        fieldName: "name",
        value: "",
        clearedAt: "2026-06-26T12:00:00.000Z",
      }),
    ]);
    expect(effective.name).toBe(base.name);
  });

  it("uses coordinate pair from same source only", () => {
    const effective = resolveEffectiveMetadata(base, [
      override({ fieldName: "lat", value: "51.45", sourceNodeId: "node-a" }),
      override({
        fieldName: "lon",
        value: "5.49",
        sourceNodeId: "node-b",
        timestamp: "2026-06-26T11:00:00.000Z",
      }),
    ]);
    expect(effective.lat).toBe(base.lat);
    expect(effective.lon).toBe(base.lon);
  });

  it("applies coordinate pair when both exist for one source", () => {
    const effective = resolveEffectiveMetadata(base, [
      override({ fieldName: "lat", value: "51.45", sourceNodeId: "node-a" }),
      override({ fieldName: "lon", value: "5.49", sourceNodeId: "node-a" }),
    ]);
    expect(effective.lat).toBe(51.45);
    expect(effective.lon).toBe(5.49);
  });
});

describe("mergeMetadataOverrides", () => {
  it("keeps newer timestamp per source field", () => {
    const merged = mergeMetadataOverrides(
      [override({ fieldName: "name", value: "Old", timestamp: "2026-06-26T09:00:00.000Z" })],
      [override({ fieldName: "name", value: "New", timestamp: "2026-06-26T10:00:00.000Z" })]
    );
    expect(merged).toHaveLength(1);
    expect(merged[0]!.value).toBe("New");
  });
});
