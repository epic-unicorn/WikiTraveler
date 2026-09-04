import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { prismaMock, requireRole, deleteSignalById, clearClosedSignals, countClosedSignals } =
  vi.hoisted(() => ({
    prismaMock: {
      communitySignal: {
        findUnique: vi.fn(),
        delete: vi.fn(),
        deleteMany: vi.fn(),
        count: vi.fn(),
      },
    },
    requireRole: vi.fn(),
    deleteSignalById: vi.fn(),
    clearClosedSignals: vi.fn(),
    countClosedSignals: vi.fn(),
  }));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/auth", () => ({
  requireRole,
  getAuthUser: vi.fn(),
  auditorId: vi.fn(),
}));
vi.mock("@/lib/communitySignals", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/communitySignals")>();
  return {
    ...actual,
    deleteSignalById,
    clearClosedSignals,
    countClosedSignals,
  };
});

import { DELETE } from "./[id]/route";
import { GET as cleanupGet, POST as cleanupPost } from "./cleanup/route";

describe("DELETE /api/admin/signals/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireRole.mockResolvedValue(null);
  });

  it("returns 403 when requireRole fails", async () => {
    requireRole.mockResolvedValue(
      Response.json({ message: "Forbidden" }, { status: 403 })
    );
    const req = new NextRequest("http://localhost/api/admin/signals/sig1", {
      method: "DELETE",
    });
    const res = await DELETE(req, { params: Promise.resolve({ id: "sig1" }) });
    expect(res.status).toBe(403);
    expect(requireRole).toHaveBeenCalledWith(req, "ADMIN");
  });

  it("deletes an existing signal", async () => {
    deleteSignalById.mockResolvedValue(true);
    const req = new NextRequest("http://localhost/api/admin/signals/sig1", {
      method: "DELETE",
    });
    const res = await DELETE(req, { params: Promise.resolve({ id: "sig1" }) });
    expect(res.status).toBe(200);
    expect(deleteSignalById).toHaveBeenCalledWith("sig1");
  });

  it("returns 404 when missing", async () => {
    deleteSignalById.mockResolvedValue(false);
    const req = new NextRequest("http://localhost/api/admin/signals/missing", {
      method: "DELETE",
    });
    const res = await DELETE(req, { params: Promise.resolve({ id: "missing" }) });
    expect(res.status).toBe(404);
  });
});

describe("POST /api/admin/signals/cleanup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireRole.mockResolvedValue(null);
  });

  it("requires ADMIN", async () => {
    requireRole.mockResolvedValue(
      Response.json({ message: "Forbidden" }, { status: 403 })
    );
    const req = new NextRequest("http://localhost/api/admin/signals/cleanup", {
      method: "POST",
    });
    const res = await cleanupPost(req);
    expect(res.status).toBe(403);
    expect(requireRole).toHaveBeenCalledWith(req, "ADMIN");
  });

  it("clears closed signals", async () => {
    clearClosedSignals.mockResolvedValue(3);
    const req = new NextRequest("http://localhost/api/admin/signals/cleanup", {
      method: "POST",
    });
    const res = await cleanupPost(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true, deleted: 3 });
  });

  it("GET returns closed count", async () => {
    countClosedSignals.mockResolvedValue(5);
    const req = new NextRequest("http://localhost/api/admin/signals/cleanup");
    const res = await cleanupGet(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toEqual({ count: 5 });
  });
});
