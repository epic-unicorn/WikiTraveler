import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock, getAuthUser, verifyToken } = vi.hoisted(() => {
  const user = {
    findUnique: vi.fn(),
    update: vi.fn(),
  };
  const favorite = {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    count: vi.fn(),
    deleteMany: vi.fn(),
    createMany: vi.fn(),
    upsert: vi.fn(),
  };
  const prisma = {
    user,
    favorite,
    $transaction: vi.fn(async (arg: unknown) => {
      if (typeof arg === "function") return (arg as (tx: typeof prisma) => unknown)(prisma);
      return Promise.all(arg as Promise<unknown>[]);
    }),
  };
  return {
    prismaMock: prisma,
    getAuthUser: vi.fn(),
    verifyToken: vi.fn(),
  };
});

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/auth", () => ({
  getAuthUser,
  requireAuth: vi.fn().mockResolvedValue(null),
  verifyToken,
}));
vi.mock("@/lib/nodeInfo", () => ({
  NODE_URL: "http://localhost:3000",
  NODE_ID: "test-node",
}));

import { GET as getMe } from "./me/route";
import { PUT as putPreferences } from "./preferences/route";
import {
  GET as getFavorites,
  PUT as putFavorites,
  POST as postFavorite,
  DELETE as deleteFavorite,
} from "./favorites/route";

const homeUser = {
  username: "alice",
  role: "USER" as const,
  homeNodeUrl: "http://localhost:3000",
};

function authReq(url: string, init?: RequestInit) {
  return new Request(url, {
    ...init,
    headers: {
      Authorization: "Bearer tok",
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

describe("auth profile preferences + favorites", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation(async (arg: unknown) => {
      if (typeof arg === "function") return (arg as (tx: typeof prismaMock) => unknown)(prismaMock);
      return Promise.all(arg as Promise<unknown>[]);
    });
    getAuthUser.mockResolvedValue(homeUser);
    verifyToken.mockResolvedValue({
      sub: "alice",
      role: "USER",
      homeNodeUrl: "http://localhost:3000",
    });
    prismaMock.user.findUnique.mockResolvedValue({
      id: "u1",
      username: "alice",
      a11yPreferences: ["elevator_present"],
      theme: "dark",
      preferencesUpdatedAt: new Date("2026-01-01T00:00:00.000Z"),
      favoritesUpdatedAt: new Date("2026-01-02T00:00:00.000Z"),
    });
  });

  it("GET /api/auth/me includes preferences on home node", async () => {
    const res = await getMe(authReq("http://localhost/api/auth/me") as never);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      username: "alice",
      preferences: {
        a11yPreferences: ["elevator_present"],
        theme: "dark",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    });
  });

  it("PUT /api/auth/preferences updates a11y + theme", async () => {
    prismaMock.user.update.mockResolvedValue({
      a11yPreferences: ["ramp_present"],
      theme: "calm",
      preferencesUpdatedAt: new Date("2026-02-01T00:00:00.000Z"),
    });
    const res = await putPreferences(
      authReq("http://localhost/api/auth/preferences", {
        method: "PUT",
        body: JSON.stringify({ a11yPreferences: ["ramp_present"], theme: "calm" }),
      }) as never
    );
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      preferences: { a11yPreferences: ["ramp_present"], theme: "calm" },
    });
  });

  it("PUT /api/auth/preferences rejects invalid theme", async () => {
    const res = await putPreferences(
      authReq("http://localhost/api/auth/preferences", {
        method: "PUT",
        body: JSON.stringify({ a11yPreferences: [], theme: "neon" }),
      }) as never
    );
    expect(res.status).toBe(422);
  });

  it("GET /api/auth/favorites lists places", async () => {
    prismaMock.favorite.findMany.mockResolvedValue([
      {
        propertyId: "p1",
        name: "Hotel",
        location: "EHV",
        nodeUrl: "http://localhost:3000",
        savedAt: new Date("2026-01-03T00:00:00.000Z"),
        imageUrl: null,
        category: "hotel",
        facts: [],
      },
    ]);
    const res = await getFavorites(authReq("http://localhost/api/auth/favorites") as never);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      places: [{ id: "p1", name: "Hotel" }],
      updatedAt: "2026-01-02T00:00:00.000Z",
    });
  });

  it("PUT /api/auth/favorites replaces the list", async () => {
    prismaMock.favorite.findMany.mockResolvedValue([]);
    const res = await putFavorites(
      authReq("http://localhost/api/auth/favorites", {
        method: "PUT",
        body: JSON.stringify({
          places: [
            {
              id: "p1",
              name: "A",
              location: "",
              nodeUrl: "http://localhost:3000",
              savedAt: "2026-01-01T00:00:00.000Z",
            },
          ],
        }),
      }) as never
    );
    expect(res.status).toBe(200);
    expect(prismaMock.favorite.deleteMany).toHaveBeenCalled();
    expect(prismaMock.favorite.createMany).toHaveBeenCalled();
  });

  it("POST /api/auth/favorites upserts one place", async () => {
    prismaMock.favorite.count.mockResolvedValue(0);
    prismaMock.favorite.findUnique.mockResolvedValue(null);
    prismaMock.favorite.findMany.mockResolvedValue([]);
    const res = await postFavorite(
      authReq("http://localhost/api/auth/favorites", {
        method: "POST",
        body: JSON.stringify({
          id: "p1",
          name: "A",
          location: "",
          nodeUrl: "http://localhost:3000",
        }),
      }) as never
    );
    expect(res.status).toBe(201);
    expect(prismaMock.favorite.upsert).toHaveBeenCalled();
  });

  it("DELETE /api/auth/favorites removes by propertyId+nodeUrl", async () => {
    prismaMock.favorite.findMany.mockResolvedValue([]);
    const res = await deleteFavorite(
      authReq(
        "http://localhost/api/auth/favorites?propertyId=p1&nodeUrl=http://localhost:3000",
        { method: "DELETE" }
      ) as never
    );
    expect(res.status).toBe(200);
    expect(prismaMock.favorite.deleteMany).toHaveBeenCalled();
  });

  it("rejects foreign home node tokens", async () => {
    getAuthUser.mockResolvedValue({
      username: "bob",
      role: "USER",
      homeNodeUrl: "https://other.example",
    });
    const res = await getFavorites(authReq("http://localhost/api/auth/favorites") as never);
    expect(res.status).toBe(403);
  });
});
