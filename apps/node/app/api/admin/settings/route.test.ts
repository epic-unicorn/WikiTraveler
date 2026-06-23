import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const { getNodeSettings, updateNodeSettings, requireRole } = vi.hoisted(() => ({
  getNodeSettings: vi.fn(),
  updateNodeSettings: vi.fn(),
  requireRole: vi.fn(),
}));

vi.mock("@/lib/nodeSettings", () => ({ getNodeSettings, updateNodeSettings }));
vi.mock("@/lib/auth", () => ({ requireRole }));

import { GET, PATCH } from "./route";

function adminOk() {
  requireRole.mockResolvedValue(null);
}

function adminDenied() {
  requireRole.mockResolvedValue(
    NextResponse.json({ message: "Forbidden" }, { status: 403 })
  );
}

describe("GET /api/admin/settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires admin role", async () => {
    adminDenied();
    const req = new NextRequest("http://localhost/api/admin/settings");
    const res = await GET(req);
    expect(res.status).toBe(403);
  });

  it("returns openRegistration setting", async () => {
    adminOk();
    getNodeSettings.mockResolvedValue({
      openRegistration: false,
      bbox: null,
      region: null,
      presetId: null,
      configuredAt: null,
      lastIngestAt: null,
      lastIngestCount: null,
      isConfigured: false,
    });
    const res = await GET(new NextRequest("http://localhost/api/admin/settings"));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ openRegistration: false });
  });
});

describe("PATCH /api/admin/settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    adminOk();
  });

  it("updates openRegistration", async () => {
    updateNodeSettings.mockResolvedValue({
      openRegistration: false,
      bbox: null,
      region: null,
      presetId: null,
      configuredAt: null,
      lastIngestAt: null,
      lastIngestCount: null,
      isConfigured: false,
    });
    const req = new NextRequest("http://localhost/api/admin/settings", {
      method: "PATCH",
      body: JSON.stringify({ openRegistration: false }),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ openRegistration: false });
    expect(updateNodeSettings).toHaveBeenCalledWith({ openRegistration: false });
  });

  it("returns 400 when no settings provided", async () => {
    const req = new NextRequest("http://localhost/api/admin/settings", {
      method: "PATCH",
      body: JSON.stringify({}),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(400);
  });
});
