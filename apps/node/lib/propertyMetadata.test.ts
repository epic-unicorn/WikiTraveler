import { describe, expect, it } from "vitest";
import { buildFieldProvenance, baseFromProperty } from "./propertyMetadata";
import type { PropertyMetadataOverride } from "@wikitraveler/core";

const property = {
  id: "p1",
  canonicalId: "osm:99",
  name: "OSM Hotel",
  location: "Main St",
  lat: 51.44,
  lon: 5.48,
};

function override(
  partial: Partial<PropertyMetadataOverride> & Pick<PropertyMetadataOverride, "fieldName" | "value">
): PropertyMetadataOverride {
  return {
    canonicalId: property.canonicalId,
    sourceType: "AUDITOR",
    sourceNodeId: "node-local",
    submittedBy: "admin",
    timestamp: "2026-06-26T10:00:00.000Z",
    signatureHash: null,
    clearedAt: null,
    ...partial,
  };
}

describe("buildFieldProvenance", () => {
  it("marks all fields as base when no overrides", () => {
    const resolved = {
      base: baseFromProperty(property),
      effective: baseFromProperty(property),
      overrides: [],
    };
    const provenance = buildFieldProvenance(resolved, "node-local");
    expect(provenance.every((p) => p.source === "base")).toBe(true);
  });

  it("marks local override fields correctly", () => {
    const overrides = [override({ fieldName: "name", value: "Fixed Name" })];
    const resolved = {
      base: baseFromProperty(property),
      effective: { ...baseFromProperty(property), name: "Fixed Name" },
      overrides,
    };
    const provenance = buildFieldProvenance(resolved, "node-local");
    expect(provenance.find((p) => p.fieldName === "name")?.source).toBe("local");
    expect(provenance.find((p) => p.fieldName === "location")?.source).toBe("base");
  });
});
