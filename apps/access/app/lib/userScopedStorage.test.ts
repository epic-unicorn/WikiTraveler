import { beforeEach, describe, expect, it } from "vitest";
import { isStringArray, readUserScoped, writeUserScoped } from "./userScopedStorage";

const KEY = "wt_test_scoped";
const mem = new Map<string, string>();

beforeEach(() => {
  mem.clear();
  const storage = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => {
      mem.set(k, v);
    },
    removeItem: (k: string) => {
      mem.delete(k);
    },
    clear: () => mem.clear(),
  };
  Object.defineProperty(globalThis, "localStorage", { value: storage, configurable: true });
});

describe("userScopedStorage", () => {
  it("does not leak another account's data when signed out", () => {
    localStorage.setItem("wt_username", "ingmar");
    writeUserScoped(KEY, ["a"]);
    localStorage.removeItem("wt_username");
    expect(readUserScoped<string[]>(KEY, [], isStringArray)).toEqual([]);
  });

  it("keeps favorites isolated per username", () => {
    localStorage.setItem("wt_username", "ingmar");
    writeUserScoped(KEY, ["hotel-1"]);
    localStorage.setItem("wt_username", "user");
    expect(readUserScoped<string[]>(KEY, [], isStringArray)).toEqual([]);
    writeUserScoped(KEY, ["hotel-2"]);
    localStorage.setItem("wt_username", "ingmar");
    expect(readUserScoped<string[]>(KEY, [], isStringArray)).toEqual(["hotel-1"]);
    localStorage.setItem("wt_username", "user");
    expect(readUserScoped<string[]>(KEY, [], isStringArray)).toEqual(["hotel-2"]);
  });

  it("migrates a legacy unscoped value onto the current user only", () => {
    localStorage.setItem(KEY, JSON.stringify(["legacy"]));
    localStorage.setItem("wt_username", "ingmar");
    expect(readUserScoped<string[]>(KEY, [], isStringArray)).toEqual(["legacy"]);
    localStorage.setItem("wt_username", "user");
    expect(readUserScoped<string[]>(KEY, [], isStringArray)).toEqual([]);
  });
});
