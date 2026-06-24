import { describe, expect, it } from "vitest";
import { buildAccessMapPopup } from "./mapPopup";
import type { MapPin } from "./accessApi";

const HOME = "http://localhost:3000";
const PEER = "http://peer:3000";

const pin: MapPin = {
  id: "p1",
  name: "Test Hotel",
  location: "Eindhoven",
  lat: 51.44,
  lon: 5.47,
  audited: false,
  facts: {
    ramp_present: { value: "yes", tier: "VERIFIED" },
  },
};

describe("buildAccessMapPopup", () => {
  it("links travelers to property detail", () => {
    const html = buildAccessMapPopup(pin, HOME, HOME, "View property", "Audited", false);
    expect(html).toContain('href="/properties/p1"');
    expect(html).not.toContain("/audit/");
    expect(html).toContain("View property");
  });

  it("links contributors to audit wizard", () => {
    const html = buildAccessMapPopup(pin, HOME, HOME, "View or audit", "Audited", true);
    expect(html).toContain('href="/audit/p1"');
  });

  it("includes peer node param when property is remote", () => {
    const html = buildAccessMapPopup(pin, HOME, PEER, "View property", "Audited", false);
    expect(html).toContain("node=http%3A%2F%2Fpeer%3A3000");
  });
});
