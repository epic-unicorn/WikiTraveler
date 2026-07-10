import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { validatePeerBaseUrl, peerApiUrl, PEER_FETCH_PATHS } from "./peerUrl";

describe("validatePeerBaseUrl", () => {
  const env = process.env;

  beforeEach(() => {
    process.env = { ...env, NODE_ENV: "production", GOSSIP_DEV: undefined };
  });

  afterEach(() => {
    process.env = env;
  });

  it("accepts public https peers in production", () => {
    const result = validatePeerBaseUrl("https://peer.example.com/");
    expect(result).toEqual({ ok: true, url: "https://peer.example.com" });
  });

  it("rejects private IPs in production", () => {
    const result = validatePeerBaseUrl("http://192.168.1.10:3000");
    expect(result.ok).toBe(false);
  });

  it("rejects metadata endpoints", () => {
    const result = validatePeerBaseUrl("http://metadata.google.internal/");
    expect(result.ok).toBe(false);
  });

  it("allows localhost in dev mode", () => {
    process.env.GOSSIP_DEV = "true";
    const result = validatePeerBaseUrl("http://localhost:3010");
    expect(result).toEqual({ ok: true, url: "http://localhost:3010" });
  });

  it("rejects non-http schemes", () => {
    const result = validatePeerBaseUrl("file:///etc/passwd");
    expect(result.ok).toBe(false);
  });
});

describe("peerApiUrl", () => {
  const env = process.env;

  beforeEach(() => {
    process.env = { ...env, NODE_ENV: "production", GOSSIP_DEV: undefined };
  });

  afterEach(() => {
    process.env = env;
  });

  it("builds validated API paths", () => {
    expect(peerApiUrl("https://peer.example.com", PEER_FETCH_PATHS.nodeinfo)).toBe(
      "https://peer.example.com/api/nodeinfo"
    );
  });

  it("returns null for blocked hosts", () => {
    expect(peerApiUrl("http://127.0.0.1:3000", PEER_FETCH_PATHS.nodeinfo)).toBeNull();
  });
});
