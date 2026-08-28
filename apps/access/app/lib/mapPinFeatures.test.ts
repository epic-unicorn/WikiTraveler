import { describe, expect, it } from "vitest";
import type { MapPin } from "./accessApi";
import { filterPinsByFeatures } from "./mapPinFeatures";

function pin(id: string, facts: MapPin["facts"]): MapPin {
  return { id, name: id, location: "", lat: 1, lon: 1, facts };
}

describe("filterPinsByFeatures", () => {
  const ramp = pin("ramp", { ramp_present: { value: "yes", tier: "VERIFIED" } });
  const osmTrue = pin("osm", { ramp_present: { value: "true", tier: "OFFICIAL" } });
  const noRamp = pin("none", { elevator_present: { value: "yes", tier: "VERIFIED" } });
  const partial = pin("partial", { ramp_present: { value: "partial", tier: "VERIFIED" } });

  it("returns all pins when no features are requested", () => {
    expect(filterPinsByFeatures([ramp, noRamp], [])).toEqual([ramp, noRamp]);
  });

  it("keeps yes and OSM true, drops missing and partial", () => {
    expect(filterPinsByFeatures([ramp, osmTrue, noRamp, partial], ["ramp_present"]).map((p) => p.id)).toEqual([
      "ramp",
      "osm",
    ]);
  });
});
