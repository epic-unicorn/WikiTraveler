import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  normalizeClientOrigin,
  collectTrustedClientOrigins,
  resolveAllowOrigin,
  getAdvertisedClientOrigins,
  getAdvertisedAccessUrl,
  applyCorsHeaders,
} from "./corsOrigins";

describe("normalizeClientOrigin", () => {
  it("normalizes https URLs to origin", () => {
    expect(normalizeClientOrigin("https://access.wikitraveler.org/app")).toBe(
      "https://access.wikitraveler.org"
    );
  });

  it("accepts chrome-extension origins", () => {
    expect(normalizeClientOrigin("chrome-extension://abcdef")).toBe("chrome-extension://abcdef");
  });

  it("rejects unsupported schemes", () => {
    expect(normalizeClientOrigin("javascript:alert(1)")).toBeNull();
    expect(normalizeClientOrigin("not a url")).toBeNull();
  });
});

describe("collectTrustedClientOrigins / resolveAllowOrigin", () => {
  const prev = { ...process.env };

  beforeEach(() => {
    delete process.env.CORS_ORIGINS;
    delete process.env.CLIENT_ORIGINS;
    delete process.env.ACCESS_PUBLIC_URL;
  });

  afterEach(() => {
    process.env.CORS_ORIGINS = prev.CORS_ORIGINS;
    process.env.CLIENT_ORIGINS = prev.CLIENT_ORIGINS;
    process.env.ACCESS_PUBLIC_URL = prev.ACCESS_PUBLIC_URL;
  });

  it("allows all when CORS_ORIGINS is unset", () => {
    const { allowAll } = collectTrustedClientOrigins(process.env);
    expect(allowAll).toBe(true);
    expect(resolveAllowOrigin("https://evil.example", process.env)).toBe("https://evil.example");
  });

  it("allows all when CORS_ORIGINS=*", () => {
    process.env.CORS_ORIGINS = "*";
    expect(resolveAllowOrigin("https://access.example", process.env)).toBe("https://access.example");
  });

  it("rejects unknown origins when allowlist is set", () => {
    process.env.CORS_ORIGINS = "https://access.wikitraveler.org";
    expect(resolveAllowOrigin("https://evil.example", process.env)).toBeNull();
    expect(resolveAllowOrigin("https://access.wikitraveler.org", process.env)).toBe(
      "https://access.wikitraveler.org"
    );
  });

  it("unions CLIENT_ORIGINS and ACCESS_PUBLIC_URL into the allowlist", () => {
    process.env.CORS_ORIGINS = "https://a.example";
    process.env.CLIENT_ORIGINS = "https://b.example, chrome-extension://lensid";
    process.env.ACCESS_PUBLIC_URL = "https://access.wikitraveler.org/";
    expect(resolveAllowOrigin("https://b.example", process.env)).toBe("https://b.example");
    expect(resolveAllowOrigin("chrome-extension://lensid", process.env)).toBe(
      "chrome-extension://lensid"
    );
    expect(resolveAllowOrigin("https://access.wikitraveler.org", process.env)).toBe(
      "https://access.wikitraveler.org"
    );
    expect(resolveAllowOrigin("https://a.example", process.env)).toBe("https://a.example");
  });

  it("does not treat comma-joined CORS string as a single origin", () => {
    process.env.CORS_ORIGINS = "https://a.example,https://b.example";
    expect(resolveAllowOrigin("https://a.example", process.env)).toBe("https://a.example");
    expect(resolveAllowOrigin("https://b.example", process.env)).toBe("https://b.example");
  });
});

describe("advertise helpers", () => {
  it("advertises CLIENT_ORIGINS and ACCESS_PUBLIC_URL only", () => {
    const env = {
      CORS_ORIGINS: "https://should-not-advertise.example",
      CLIENT_ORIGINS: "https://hub.example",
      ACCESS_PUBLIC_URL: "https://access.wikitraveler.org",
    };
    expect(getAdvertisedClientOrigins(env)).toEqual([
      "https://access.wikitraveler.org",
      "https://hub.example",
    ]);
    expect(getAdvertisedAccessUrl(env)).toBe("https://access.wikitraveler.org");
  });
});

describe("applyCorsHeaders", () => {
  it("sets Vary and omits Allow-Origin when denied", () => {
    const headers = new Headers();
    const ok = applyCorsHeaders(headers, "https://evil.example", {
      CORS_ORIGINS: "https://access.wikitraveler.org",
    });
    expect(ok).toBe(false);
    expect(headers.get("Access-Control-Allow-Origin")).toBeNull();
    expect(headers.get("Vary")).toBe("Origin");
    expect(headers.get("Access-Control-Allow-Methods")).toContain("GET");
  });
});
