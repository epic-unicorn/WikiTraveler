import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { requestUserLocation } from "./geolocation";

describe("requestUserLocation", () => {
  const getCurrentPosition = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("navigator", {
      geolocation: { getCurrentPosition },
      permissions: {
        query: vi.fn().mockResolvedValue({ state: "prompt" }),
      },
    });
    vi.stubGlobal("window", { isSecureContext: true });
    getCurrentPosition.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns denied immediately when permission is already blocked", async () => {
    vi.mocked(navigator.permissions!.query).mockResolvedValue({ state: "denied" } as PermissionStatus);

    const result = await requestUserLocation();

    expect(result).toEqual({ ok: false, reason: "denied" });
    expect(getCurrentPosition).not.toHaveBeenCalled();
  });

  it("returns unsupported when geolocation API is missing", async () => {
    vi.stubGlobal("navigator", { permissions: { query: vi.fn() } });

    const result = await requestUserLocation();

    expect(result).toEqual({ ok: false, reason: "unsupported" });
  });

  it("returns insecure when the page is not a secure context", async () => {
    vi.stubGlobal("window", { isSecureContext: false });

    const result = await requestUserLocation();

    expect(result).toEqual({ ok: false, reason: "insecure" });
    expect(getCurrentPosition).not.toHaveBeenCalled();
  });
});
