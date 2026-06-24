import { describe, expect, it } from "vitest";
import { getVisiblePins } from "./mapVisiblePins";
import type { MapPin } from "./mapPopup";

const pins: MapPin[] = [
  { id: "a", name: "A", location: "X", lat: 1, lon: 1, audited: false },
  { id: "b", name: "B", location: "Y", lat: 2, lon: 2, audited: true },
  { id: "c", name: "C", location: "Z", lat: 3, lon: 3, audited: false },
];

describe("getVisiblePins", () => {
  it("returns all pins when no filters", () => {
    expect(getVisiblePins(pins, null)).toHaveLength(3);
  });

  it("filters to focus pin ids", () => {
    const focus = [{ id: "b", name: "B", location: "Y", lat: 2, lon: 2 }];
    expect(getVisiblePins(pins, focus).map((p) => p.id)).toEqual(["b"]);
  });

  it("filters audited-only pins", () => {
    expect(getVisiblePins(pins, null, true).map((p) => p.id)).toEqual(["b"]);
  });

  it("applies focus before audited filter", () => {
    const focus = [{ id: "a", name: "A", location: "X", lat: 1, lon: 1 }];
    expect(getVisiblePins(pins, focus, true)).toHaveLength(0);
  });
});
