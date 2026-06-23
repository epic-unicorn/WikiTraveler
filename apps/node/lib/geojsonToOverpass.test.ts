import { describe, expect, it } from "vitest";
import { geoJsonFeatureToElement, parseGeoJsonExport } from "./geojsonToOverpass";

describe("geoJsonFeatureToElement", () => {
  it("parses a node feature from osmium geojson export", () => {
    const el = geoJsonFeatureToElement({
      type: "Feature",
      geometry: { type: "Point", coordinates: [5.47, 51.44] },
      properties: {
        "@id": "node/12345",
        name: "Test Hotel",
        tourism: "hotel",
      },
    });
    expect(el).toEqual({
      type: "node",
      id: 12345,
      lat: 51.44,
      lon: 5.47,
      tags: { name: "Test Hotel", tourism: "hotel" },
    });
  });

  it("parses a way feature with center point", () => {
    const el = geoJsonFeatureToElement({
      type: "Feature",
      geometry: { type: "Point", coordinates: [2.35, 48.86] },
      properties: {
        "@id": "way/999",
        type: "way",
        name: "Grand Hotel",
        tourism: "hotel",
      },
    });
    expect(el?.type).toBe("way");
    expect(el?.id).toBe(999);
    expect(el?.center).toEqual({ lat: 48.86, lon: 2.35 });
  });
});

describe("parseGeoJsonExport", () => {
  it("parses geojsonseq lines", () => {
    const content = [
      '{"type":"Feature","geometry":{"type":"Point","coordinates":[5.47,51.44]},"properties":{"@id":"node/1","name":"A","tourism":"hotel"}}',
      '{"type":"Feature","geometry":{"type":"Point","coordinates":[5.48,51.45]},"properties":{"@id":"node/2","name":"B","tourism":"hostel"}}',
    ].join("\n");
    const elements = parseGeoJsonExport(content);
    expect(elements).toHaveLength(2);
    expect(elements[0]?.tags.name).toBe("A");
  });
});
