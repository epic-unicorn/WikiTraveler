import { describe, expect, it } from "vitest";
import { normalizeNodeBaseUrl, safePathId } from "./safeHttpUrl";

describe("normalizeNodeBaseUrl", () => {
  it("keeps http(s) origins", () => {
    expect(normalizeNodeBaseUrl("http://localhost:3000/")).toBe("http://localhost:3000");
    expect(normalizeNodeBaseUrl("https://node.example.com/path")).toBe("https://node.example.com");
  });

  it("rejects non-http schemes and credentials", () => {
    expect(normalizeNodeBaseUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeNodeBaseUrl("data:text/html,hi")).toBeNull();
    expect(normalizeNodeBaseUrl("https://user:pass@evil.com")).toBeNull();
    expect(normalizeNodeBaseUrl("not a url")).toBeNull();
  });
});

describe("safePathId", () => {
  it("encodes path-sensitive characters", () => {
    expect(safePathId("p1")).toBe("p1");
    expect(safePathId("a/b")).toBe("a%2Fb");
  });
});
