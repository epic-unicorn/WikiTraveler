import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const { prismaMock, requireRole, hashMock } = vi.hoisted(() => ({
  prismaMock: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
  requireRole: vi.fn(),
  hashMock: vi.fn().mockResolvedValue("hashed-password"),
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/auth", () => ({ requireRole }));
vi.mock("bcryptjs", () => ({ hash: hashMock }));

import { PATCH, DELETE } from "./route";

function adminOk() {
  requireRole.mockResolvedValue(null);
}

function patchReq(username: string, body: unknown) {
  return new NextRequest(`http://localhost/api/admin/users/${username}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("PATCH /api/admin/users/:username", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hashMock.mockResolvedValue("hashed-password");
    adminOk();
    prismaMock.user.findUnique.mockResolvedValue({
      id: "1",
      username: "alice",
      role: "USER",
      passwordHash: "old-hash",
    });
    prismaMock.user.update.mockResolvedValue({ username: "alice", role: "AUDITOR" });
  });

  it("updates role", async () => {
    const res = await PATCH(patchReq("alice", { role: "AUDITOR" }), { params: { username: "alice" } });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      ok: true,
      user: { username: "alice", role: "AUDITOR" },
      passwordUpdated: false,
    });
    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { role: "AUDITOR" } })
    );
  });

  it("sets a new password", async () => {
    prismaMock.user.update.mockResolvedValue({ username: "alice", role: "USER" });
    const res = await PATCH(patchReq("alice", { password: "newpassword1" }), { params: { username: "alice" } });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ passwordUpdated: true });
    expect(hashMock).toHaveBeenCalledWith("newpassword1", 12);
    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { username: "alice" },
        data: expect.objectContaining({ passwordHash: "hashed-password" }),
      })
    );
  });

  it("rejects short passwords", async () => {
    const res = await PATCH(patchReq("alice", { password: "short" }), { params: { username: "alice" } });
    expect(res.status).toBe(422);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it("requires role or password", async () => {
    const res = await PATCH(patchReq("alice", {}), { params: { username: "alice" } });
    expect(res.status).toBe(422);
  });

  it("returns 404 for unknown user", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    const res = await PATCH(patchReq("missing", { role: "USER" }), { params: { username: "missing" } });
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/admin/users/:username", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    adminOk();
    prismaMock.user.findUnique.mockResolvedValue({ username: "alice" });
    prismaMock.user.delete.mockResolvedValue({});
  });

  it("deletes an existing user", async () => {
    const res = await DELETE(
      new NextRequest("http://localhost/api/admin/users/alice", { method: "DELETE" }),
      { params: { username: "alice" } }
    );
    expect(res.status).toBe(200);
    expect(prismaMock.user.delete).toHaveBeenCalledWith({ where: { username: "alice" } });
  });
});
