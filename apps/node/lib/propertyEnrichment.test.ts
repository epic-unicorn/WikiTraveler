import { describe, expect, it } from "vitest";
import { buildPropertyDetail, buildConfidenceSummary } from "./propertyEnrichment";

describe("propertyEnrichment", () => {
  const property = {
    id: "p1",
    name: "Test Hotel",
    location: "Rotterdam, NL",
    lat: 51.9,
    lon: 4.5,
    osmId: "node/123",
    wheelmapId: "456",
    canonicalId: "c1",
    dataSource: "NODE_ORIGINAL",
    claimedByUserId: null,
    claimedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it("builds property detail with source links and photos", () => {
    const detail = buildPropertyDetail(
      property,
      [{ fieldName: "step_free_entrance", tier: "VERIFIED" }],
      [{ url: "https://example.com/p.jpg", caption: "Door" }]
    );
    expect(detail.sourceLinks).toHaveLength(2);
    expect(detail.photos).toHaveLength(1);
    expect(detail.address).toBe("Rotterdam, NL");
  });

  it("summarizes confidence counts", () => {
    const summary = buildConfidenceSummary(
      [
        { fieldName: "a", tier: "VERIFIED" },
        { fieldName: "b", tier: "AI_GUESS" },
        { fieldName: "c", tier: "OFFICIAL" },
      ],
      "2026-06-01T00:00:00.000Z"
    );
    expect(summary.verifiedCount).toBe(1);
    expect(summary.aiGuessCount).toBe(1);
    expect(summary.officialCount).toBe(1);
    expect(summary.lastAuditAt).toBe("2026-06-01T00:00:00.000Z");
  });
});
