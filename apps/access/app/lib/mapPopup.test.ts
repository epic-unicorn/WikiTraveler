import { describe, expect, it } from "vitest";
import { buildAccessMapPopup, buildAccessMapTooltip } from "./mapPopup";
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

const LABELS = { view: "View property", audit: "Start audit", auditedOpen: "Audited" };

describe("buildAccessMapPopup", () => {
  it("links travelers to property detail only", () => {
    const html = buildAccessMapPopup(pin, HOME, HOME, LABELS, false);
    expect(html).toContain('href="/properties/p1"');
    expect(html).not.toContain("/audit/");
    expect(html).toContain("View property");
  });

  it("offers contributors both view and audit choices", () => {
    const html = buildAccessMapPopup(pin, HOME, HOME, LABELS, true);
    expect(html).toContain('href="/properties/p1"');
    expect(html).toContain('href="/audit/p1"');
    expect(html).toContain("View property");
    expect(html).toContain("Start audit");
  });

  it("includes peer node param when property is remote", () => {
    const html = buildAccessMapPopup(pin, HOME, PEER, LABELS, false);
    expect(html).toContain("node=http%3A%2F%2Fpeer%3A3000");
  });
});

describe("buildAccessMapTooltip", () => {
  it("shows name and address only", () => {
    const html = buildAccessMapTooltip(pin);
    expect(html).toContain("Test Hotel");
    expect(html).toContain("Eindhoven");
    expect(html).not.toContain("wt-popup-cta");
    expect(html).not.toContain("/properties/");
    expect(html).not.toContain("/audit/");
  });
});
