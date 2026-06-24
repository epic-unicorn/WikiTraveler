import { describe, expect, it } from "vitest";
import { selectOldestCacheKeys } from "../app/lib/offlineCache";

describe("selectOldestCacheKeys", () => {
  it("returns nothing when under the cap", () => {
    expect(
      selectOldestCacheKeys(
        [
          { key: "a", fetchedAt: "2026-01-01" },
          { key: "b", fetchedAt: "2026-01-02" },
        ],
        3
      )
    ).toEqual([]);
  });

  it("evicts oldest entries first", () => {
    expect(
      selectOldestCacheKeys(
        [
          { key: "new", fetchedAt: "2026-03-01" },
          { key: "mid", fetchedAt: "2026-02-01" },
          { key: "old", fetchedAt: "2026-01-01" },
        ],
        2
      )
    ).toEqual(["old"]);
  });

  it("evicts multiple oldest when far over cap", () => {
    expect(
      selectOldestCacheKeys(
        [
          { key: "1", fetchedAt: "2026-01-01" },
          { key: "2", fetchedAt: "2026-01-02" },
          { key: "3", fetchedAt: "2026-01-03" },
          { key: "4", fetchedAt: "2026-01-04" },
        ],
        2
      )
    ).toEqual(["1", "2"]);
  });
});
