import { describe, expect, it } from "vitest";
import { resolveAiScanLimit } from "./aiScanLimit";

describe("resolveAiScanLimit", () => {
  it("defaults to 20 when env and query param are absent", () => {
    expect(resolveAiScanLimit(null)).toBe(20);
  });

  it("uses MAX_AI_SCAN_PER_RUN as the default", () => {
    expect(resolveAiScanLimit(null, "35")).toBe(35);
  });

  it("caps env default at 50", () => {
    expect(resolveAiScanLimit(null, "100")).toBe(50);
  });

  it("falls back to 20 when env value is invalid", () => {
    expect(resolveAiScanLimit(null, "not-a-number")).toBe(20);
  });

  it("honours ?limit=N query param", () => {
    expect(resolveAiScanLimit("12", "20")).toBe(12);
  });

  it("caps query param at 50", () => {
    expect(resolveAiScanLimit("999", "20")).toBe(50);
  });

  it("falls back to env default when query param is invalid", () => {
    expect(resolveAiScanLimit("abc", "30")).toBe(30);
  });
});
