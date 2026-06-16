import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const { prismaMock, requireRole } = vi.hoisted(() => ({
  prismaMock: {
    nodePeer: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
  },
  requireRole: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/nodeInfo", () => ({ NODE_ID: "node-a", NODE_URL: "http://localhost:3000" }));
vi.mock("@/lib/auth", () => ({ requireRole }));

import { DELETE, GET, POST } from "./route";

function adminOk() {
  requireRole.mockResolvedValue(null);
}

function adminDenied() {
  requireRole.mockResolvedValue(
    NextResponse.json({ message: "Forbidden" }, { status: 403 })
  );
}

describe("GET /api/nodes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns active peers excluding self", async () => {
    const peers = [
      { url: "https://peer.example.com", nodeId: "node-b", isActive: true },
      { url: "http://node-a:3000", nodeId: "node-a", isActive: true },
    ];
    prismaMock.nodePeer.findMany.mockResolvedValue(peers);

    const res = await GET();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      peers: [{ url: "https://peer.example.com", nodeId: "node-b", isActive: true }],
    });
  });
});

describe("POST /api/nodes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          nodeId: "peer-1",
          region: "Netherlands",
          bbox: "50,3,53,7",
          publicKeyPem: "pem",
        }),
      })
    );
  });

  it("requires admin role", async () => {
    adminDenied();
    const req = new NextRequest("http://localhost/api/nodes", {
      method: "POST",
      body: JSON.stringify({ url: "https://peer.example.com" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("rejects adding this node as its own peer", async () => {
    adminOk();
    const req = new NextRequest("http://localhost/api/nodes", {
      method: "POST",
      body: JSON.stringify({ url: "http://localhost:3000/" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({
      message: expect.stringContaining("own peer"),
    });
  });

  it("returns 502 when the remote node is unreachable", async () => {
    adminOk();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    const req = new NextRequest("http://localhost/api/nodes", {
      method: "POST",
      body: JSON.stringify({ url: "https://dead.example.com" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(502);
  });

  it("upserts a reachable peer and returns 201", async () => {
    adminOk();
    const peer = { url: "https://peer.example.com", nodeId: "peer-1" };
    prismaMock.nodePeer.upsert.mockResolvedValue(peer);

    const req = new NextRequest("http://localhost/api/nodes", {
      method: "POST",
      body: JSON.stringify({ url: "https://peer.example.com/" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    await expect(res.json()).resolves.toEqual({ peer });
    expect(prismaMock.nodePeer.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { url: "https://peer.example.com" },
        create: expect.objectContaining({ isActive: true }),
      })
    );
  });
});

describe("DELETE /api/nodes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires url query parameter", async () => {
    adminOk();
    const req = new NextRequest("http://localhost/api/nodes", { method: "DELETE" });
    const res = await DELETE(req);
    expect(res.status).toBe(422);
  });

  it("returns 404 when peer does not exist", async () => {
    adminOk();
    prismaMock.nodePeer.findUnique.mockResolvedValue(null);
    const req = new NextRequest(
      "http://localhost/api/nodes?url=https%3A%2F%2Fmissing.example.com",
      { method: "DELETE" }
    );
    const res = await DELETE(req);
    expect(res.status).toBe(404);
  });

  it("deactivates an existing peer", async () => {
    adminOk();
    prismaMock.nodePeer.findUnique.mockResolvedValue({
      url: "https://peer.example.com",
      isActive: true,
    });
    const req = new NextRequest(
      "http://localhost/api/nodes?url=https%3A%2F%2Fpeer.example.com",
      { method: "DELETE" }
    );
    const res = await DELETE(req);
    expect(res.status).toBe(200);
    expect(prismaMock.nodePeer.update).toHaveBeenCalledWith({
      where: { url: "https://peer.example.com" },
      data: { isActive: false },
    });
  });
});
