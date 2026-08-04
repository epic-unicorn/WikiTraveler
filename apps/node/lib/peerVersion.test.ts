import { describe, expect, it } from "vitest";
import { assessPeerSkew, minorVersionGap } from "./peerVersion";

describe("minorVersionGap", () => {
  it("returns 0 for same version", () => {
    expect(minorVersionGap("0.2.0", "0.2.1")).toBe(0);
  });

  it("returns 1 for adjacent minors", () => {
    expect(minorVersionGap("0.2.0", "0.1.0")).toBe(1);
  });

  it("returns null for different majors", () => {
    expect(minorVersionGap("1.0.0", "0.9.0")).toBeNull();
  });
});

describe("assessPeerSkew", () => {
  it("accepts N-1 minor skew", () => {
    const result = assessPeerSkew({
      localVersion: "0.2.0",
      localGossipProtocol: 2,
      peerVersion: "0.1.0",
      peerGossipProtocol: 1,
    });
    expect(result.level).toBe("ok");
  });

  it("warns when peer is two minors away", () => {
    const result = assessPeerSkew({
      localVersion: "0.2.0",
      localGossipProtocol: 2,
      peerVersion: "0.0.5",
      peerGossipProtocol: 1,
    });
    expect(result.level).toBe("warn");
  });

  it("errors when gossip protocol is below minimum", () => {
    const result = assessPeerSkew({
      localVersion: "0.2.0",
      localGossipProtocol: 2,
      peerVersion: "0.2.0",
      peerGossipProtocol: 0,
    });
    expect(result.level).toBe("error");
  });
});
