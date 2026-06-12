import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const { prismaMock, requireRole } = vi.hoisted(() => ({
  prismaMock: {
    nodePeer: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
  },
  requireRole: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/auth", () => ({ requireRole }));

import { POST } from "./route";

describe("POST /api/nodes/refresh", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireRole.mockResolvedValue(null);
  });

  it("requires admin role", async () => {
    requireRole.mockResolvedValue(
      NextResponse.json({ message: "Forbidden" }, { status: 403 })
    );
    const req = new NextRequest("http://localhost/api/nodes/refresh", {
      method: "POST",
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("updates reachable peers and reports counts", async () => {
    prismaMock.nodePeer.findMany.mockResolvedValue([
      { url: "https://peer-a.example.com" },
      { url: "https://peer-b.example.com" },
    ]);

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("peer-a")) {
          return {
            ok: true,
            json: async () => ({
              nodeId: "a",
              region: "NL",
              bbox: "50,3,53,7",
              publicKeyPem: "pem-a",
            }),
          };
        }
        return { ok: false };
      })
    );

    const req = new NextRequest("http://localhost/api/nodes/refresh", {
      method: "POST",
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      updated: 1,
      failed: 1,
      total: 2,
    });
    expect(prismaMock.nodePeer.update).toHaveBeenCalledTimes(1);
  });
});
