import { describe, expect, it } from "vitest";
import { assessClientNodeVersions, assessUpgrade } from "./upgradeStatus";

describe("assessUpgrade", () => {
  it("warns when below minRecommended", () => {
    const result = assessUpgrade({
      currentVersion: "0.1.0",
      manifest: { latest: "0.2.0", minRecommended: "0.2.0" },
    });
    expect(result.level).toBe("warn");
  });

  it("info when behind latest but above minRecommended", () => {
    const result = assessUpgrade({
      currentVersion: "0.2.0",
      manifest: { latest: "0.3.0", minRecommended: "0.2.0" },
    });
    expect(result.level).toBe("info");
  });
});

describe("assessClientNodeVersions", () => {
  it("warns when client is newer than node", () => {
    const result = assessClientNodeVersions({ clientVersion: "0.3.0", nodeVersion: "0.2.0" });
    expect(result.level).toBe("warn");
  });
});
