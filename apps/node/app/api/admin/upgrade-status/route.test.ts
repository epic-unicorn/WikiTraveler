import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const { requireRole, fetchReleaseManifest } = vi.hoisted(() => ({
  requireRole: vi.fn(),
  fetchReleaseManifest: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireRole }));
vi.mock("@/lib/releaseManifest", () => ({
  fetchReleaseManifest,
  assessUpgrade: (params: {
    currentVersion: string;
    manifest: { latest: string; minRecommended: string } | null;
  }) => {
    if (!params.manifest) {
      return { level: "ok", message: null, latest: null, minRecommended: null };
    }
    if (params.currentVersion === "0.1.0" && params.manifest.minRecommended === "0.2.0") {
      return {
        level: "warn",
        message: "upgrade recommended",
        latest: params.manifest.latest,
        minRecommended: params.manifest.minRecommended,
      };
    }
    return { level: "ok", message: null, latest: params.manifest.latest, minRecommended: params.manifest.minRecommended };
  },
}));
vi.mock("@/lib/nodeInfo", () => ({ NODE_VERSION: "0.1.0" }));

import { GET } from "./route";

describe("GET /api/admin/upgrade-status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires admin role", async () => {
    requireRole.mockResolvedValue(NextResponse.json({ message: "Forbidden" }, { status: 403 }));
    const res = await GET(new NextRequest("http://localhost/api/admin/upgrade-status"));
    expect(res.status).toBe(403);
  });

  it("returns upgrade advisory when manifest is newer", async () => {
    requireRole.mockResolvedValue(null);
    fetchReleaseManifest.mockResolvedValue({ latest: "0.2.0", minRecommended: "0.2.0" });
    const res = await GET(new NextRequest("http://localhost/api/admin/upgrade-status"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.currentVersion).toBe("0.1.0");
    expect(body.upgrade.level).toBe("warn");
  });
});
