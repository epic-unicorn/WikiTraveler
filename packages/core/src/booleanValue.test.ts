import { describe, expect, it } from "vitest";
import { normalizeBooleanValue } from "./booleanValue";

describe("normalizeBooleanValue", () => {
  it("keeps canonical tokens", () => {
    expect(normalizeBooleanValue("yes")).toBe("yes");
    expect(normalizeBooleanValue("no")).toBe("no");
    expect(normalizeBooleanValue("partial")).toBe("partial");
    expect(normalizeBooleanValue("n/a")).toBe("n/a");
  });

  it("maps OSM / Wheelmap aliases", () => {
    expect(normalizeBooleanValue("true")).toBe("yes");
    expect(normalizeBooleanValue("false")).toBe("no");
    expect(normalizeBooleanValue("limited")).toBe("partial");
  });

  it("maps locale display strings auditors might submit", () => {
    expect(normalizeBooleanValue("Ja")).toBe("yes");
    expect(normalizeBooleanValue("Nee")).toBe("no");
    expect(normalizeBooleanValue("Gedeeltelijk")).toBe("partial");
    expect(normalizeBooleanValue("n.v.t.")).toBe("n/a");
  });

  it("rejects unknown values", () => {
    expect(normalizeBooleanValue("")).toBeNull();
    expect(normalizeBooleanValue("maybe")).toBeNull();
    expect(normalizeBooleanValue("1")).toBeNull();
  });
});
