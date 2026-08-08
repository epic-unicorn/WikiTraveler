import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  canonicalizeLabPeerUrl,
  labPubkeyFetchCandidates,
  labSelfUrlAliases,
} from "./gossipLabUrls";

describe("gossipLabUrls", () => {
  const prev = { ...process.env };

  beforeEach(() => {
    process.env.GOSSIP_DEV = "true";
  });

  afterEach(() => {
    process.env = { ...prev };
  });

  it("rewrites host-mapped lab ports to docker service URLs", () => {
    expect(canonicalizeLabPeerUrl("http://localhost:3010")).toBe("http://node-b:3000");
    expect(canonicalizeLabPeerUrl("http://127.0.0.1:3000/")).toBe("http://node-a:3000");
    expect(canonicalizeLabPeerUrl("http://localhost:3020")).toBe("http://node-c:3000");
  });

  it("leaves non-lab URLs unchanged", () => {
    expect(canonicalizeLabPeerUrl("https://peer.example.com")).toBe("https://peer.example.com");
    expect(canonicalizeLabPeerUrl("http://node-b:3000")).toBe("http://node-b:3000");
  });

  it("does not rewrite when GOSSIP_DEV is off", () => {
    delete process.env.GOSSIP_DEV;
    expect(canonicalizeLabPeerUrl("http://localhost:3010")).toBe("http://localhost:3010");
  });

  it("lists pubkey fetch candidates for host homeNodeUrl", () => {
    expect(labPubkeyFetchCandidates("http://localhost:3000")).toEqual([
      "http://localhost:3000",
      "http://node-a:3000",
    ]);
  });

  it("lists host alias for docker homeNodeUrl", () => {
    const c = labPubkeyFetchCandidates("http://node-b:3000");
    expect(c[0]).toBe("http://node-b:3000");
    expect(c).toContain("http://localhost:3010");
  });

  it("returns lab self aliases for node-b", () => {
    expect(labSelfUrlAliases("node-b")).toEqual([
      "http://localhost:3010",
      "http://127.0.0.1:3010",
      "http://node-b:3000",
    ]);
  });
});
