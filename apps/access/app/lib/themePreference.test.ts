import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { DEFAULT_ACCESS_THEME, readAccessThemePreference } from "./themePreference";

vi.mock("./authStorage", () => ({
  readAuthToken: vi.fn(),
}));

import { readAuthToken } from "./authStorage";

describe("readAccessThemePreference", () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
      clear: () => store.clear(),
    });
    vi.mocked(readAuthToken).mockReturnValue(null);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns standard theme when signed out", () => {
    expect(readAccessThemePreference()).toBe(DEFAULT_ACCESS_THEME);
  });

  it("returns per-user theme when signed in", () => {
    vi.mocked(readAuthToken).mockReturnValue("token");
    localStorage.setItem("wt_username", "alice");
    localStorage.setItem(
      "wt_access_theme",
      JSON.stringify({ byUser: { alice: "dark" } })
    );
    expect(readAccessThemePreference()).toBe("dark");
  });
});
