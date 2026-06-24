import { describe, expect, it } from "vitest";
import { createRequestCounter } from "@wikitraveler/core";

describe("createRequestCounter", () => {
  it("marks only the latest request as current", () => {
    const counter = createRequestCounter();
    const first = counter.next();
    expect(counter.isLatest(first)).toBe(true);

    const second = counter.next();
    expect(counter.isLatest(first)).toBe(false);
    expect(counter.isLatest(second)).toBe(true);
  });

  it("ignores stale async results after a newer request starts", async () => {
    const counter = createRequestCounter();
    const staleId = counter.next();
    const latestId = counter.next();

    const staleMayCommit = counter.isLatest(staleId);
    const latestMayCommit = counter.isLatest(latestId);

    expect(staleMayCommit).toBe(false);
    expect(latestMayCommit).toBe(true);
  });
});
