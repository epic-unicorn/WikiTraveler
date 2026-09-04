import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./authStorage", () => ({
  AUTH_CHANGED_EVENT: "wt-auth-changed",
  readAuthToken: vi.fn(() => "tok"),
}));

vi.mock("./accessApi", () => ({
  getStoredNodeUrl: () => "http://localhost:3000",
  getAuthHeaders: () => ({ Authorization: "Bearer tok" }),
}));

import { writeA11yPreferences, readA11yPreferences } from "./a11yPreferences";
import { readSavedPlaces, writeSavedPlaces } from "./savedPlaces";
import { syncProfileFromServer } from "./profileSync";

const mem = new Map<string, string>();

function jsonResponse(data: unknown, ok = true): Response {
  return {
    ok,
    json: async () => data,
  } as Response;
}

describe("syncProfileFromServer", () => {
  beforeEach(() => {
    mem.clear();
    Object.defineProperty(globalThis, "localStorage", {
      value: {
        getItem: (k: string) => mem.get(k) ?? null,
        setItem: (k: string, v: string) => {
          mem.set(k, v);
        },
        removeItem: (k: string) => {
          mem.delete(k);
        },
        clear: () => mem.clear(),
      },
      configurable: true,
    });
    localStorage.setItem("wt_username", "alice");
    localStorage.setItem("wt_node_url", "http://localhost:3000");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("hydrates local cache from server when server is newer", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith("/api/auth/me")) {
          return jsonResponse({
            preferences: {
              a11yPreferences: ["elevator_present"],
              theme: "dark",
              updatedAt: "2026-06-01T00:00:00.000Z",
            },
          });
        }
        if (url.includes("/api/auth/favorites")) {
          return jsonResponse({
            places: [
              {
                id: "p1",
                name: "Hotel",
                location: "EHV",
                nodeUrl: "http://localhost:3000",
                savedAt: "2026-06-01T00:00:00.000Z",
              },
            ],
            updatedAt: "2026-06-01T00:00:00.000Z",
          });
        }
        return jsonResponse({}, false);
      })
    );

    await syncProfileFromServer();
    expect(readA11yPreferences()).toEqual(["elevator_present"]);
    expect(readSavedPlaces()).toHaveLength(1);
    expect(readSavedPlaces()[0]?.id).toBe("p1");
  });

  it("pushes legacy local favorites when server list is empty", async () => {
    writeSavedPlaces(
      [
        {
          id: "local-1",
          name: "Local",
          location: "",
          nodeUrl: "http://localhost:3000",
          savedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      { skipSync: true }
    );
    writeA11yPreferences([], { skipSync: true });

    const putBodies: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith("/api/auth/me")) {
          return jsonResponse({
            preferences: {
              a11yPreferences: [],
              theme: null,
              updatedAt: "2020-01-01T00:00:00.000Z",
            },
          });
        }
        if (url.includes("/api/auth/favorites") && init?.method === "PUT") {
          putBodies.push(String(init.body));
          return jsonResponse({
            places: JSON.parse(String(init.body)).places,
            updatedAt: "2026-07-01T00:00:00.000Z",
          });
        }
        if (url.includes("/api/auth/favorites")) {
          return jsonResponse({ places: [], updatedAt: "2020-01-01T00:00:00.000Z" });
        }
        if (url.includes("/api/auth/preferences") && init?.method === "PUT") {
          return jsonResponse({
            preferences: {
              a11yPreferences: [],
              theme: "light",
              updatedAt: "2026-07-01T00:00:00.000Z",
            },
          });
        }
        return jsonResponse({}, false);
      })
    );

    await syncProfileFromServer();
    expect(putBodies.length).toBeGreaterThan(0);
    expect(putBodies[0]).toContain("local-1");
  });
});
