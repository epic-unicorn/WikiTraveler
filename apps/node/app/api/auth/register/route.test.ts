import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock, getOpenRegistration } = vi.hoisted(() => ({
  prismaMock: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
  getOpenRegistration: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/nodeSettings", () => ({ getOpenRegistration }));
vi.mock("bcryptjs", () => ({
  default: { hash: vi.fn().mockResolvedValue("hashed") },
}));

import { GET, POST } from "./route";

describe("GET /api/auth/register", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns openRegistration from node settings", async () => {
    getOpenRegistration.mockResolvedValue(true);
    const res = await GET();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ openRegistration: true });
  });

  it("returns false when registration is closed", async () => {
    getOpenRegistration.mockResolvedValue(false);
    const res = await GET();
    await expect(res.json()).resolves.toEqual({ openRegistration: false });
  });
});

describe("POST /api/auth/register", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getOpenRegistration.mockResolvedValue(true);
  });

  it("returns 403 when registration is closed", async () => {
    getOpenRegistration.mockResolvedValue(false);
    const res = await POST(
      new Request("http://localhost/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "alice", password: "password1" }),
      })
    );
    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toMatchObject({
      message: expect.stringContaining("closed"),
    });
  });

  it("creates a user when registration is open", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.user.create.mockResolvedValue({ username: "alice" });

    const res = await POST(
      new Request("http://localhost/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "Alice", password: "password1" }),
      })
    );
    expect(res.status).toBe(201);
    await expect(res.json()).resolves.toEqual({ ok: true, username: "alice" });
    expect(prismaMock.user.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ username: "alice", role: "USER" }) })
    );
  });

  it("returns 409 when username is taken", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: "1", username: "alice" });
    const res = await POST(
      new Request("http://localhost/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "alice", password: "password1" }),
      })
    );
    expect(res.status).toBe(409);
  });
});
