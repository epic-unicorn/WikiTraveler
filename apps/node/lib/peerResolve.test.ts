import { describe, expect, it } from "vitest";
import { pickBestContainingPeer } from "./peerResolve";

describe("pickBestContainingPeer", () => {
  const wide = {
    url: "https://wide.example",
    nodeId: "wide",
    region: "Wide",
    bbox: "50.0,3.0,54.0,8.0", // large
  };
  const small = {
    url: "https://small.example",
    nodeId: "small",
    region: "City",
    bbox: "51.4,5.4,51.5,5.5", // Eindhoven-ish
  };
  const other = {
    url: "https://other.example",
    nodeId: "other",
    region: "Other",
    bbox: "48.0,2.0,49.0,3.0",
  };

  it("returns null when no peer contains the point", () => {
    expect(pickBestContainingPeer(0, 0, [wide, small, other])).toBeNull();
  });

  it("prefers the smallest containing bbox over a larger one", () => {
    const best = pickBestContainingPeer(51.44, 5.47, [wide, small]);
    expect(best?.url).toBe("https://small.example");
  });

  it("ignores peers that do not contain the point", () => {
    const best = pickBestContainingPeer(51.44, 5.47, [other, small]);
    expect(best?.url).toBe("https://small.example");
  });

  it("breaks ties by nearer bbox center", () => {
    const left = {
      url: "https://left.example",
      nodeId: "left",
      region: "L",
      bbox: "51.0,5.0,52.0,5.5", // center ~51.5, 5.25
    };
    const right = {
      url: "https://right.example",
      nodeId: "right",
      region: "R",
      bbox: "51.0,5.4,52.0,5.9", // center ~51.5, 5.65 — same area-ish
    };
    // Point closer to right center
    const best = pickBestContainingPeer(51.5, 5.6, [left, right]);
    expect(best?.url).toBe("https://right.example");
  });
});
