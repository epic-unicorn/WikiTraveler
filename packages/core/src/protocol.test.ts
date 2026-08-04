import { describe, expect, it } from "vitest";
import {
  DEFAULT_GOSSIP_DELTA_PROTOCOL_VERSION,
  GOSSIP_PROTOCOL_VERSION,
  MIN_SUPPORTED_GOSSIP_PROTOCOL,
  isSupportedGossipDeltaProtocol,
  resolveGossipDeltaProtocolVersion,
} from "./protocol";

describe("gossip protocol", () => {
  it("emits protocol 2 while still accepting protocol 1 (N↔N-1)", () => {
    expect(GOSSIP_PROTOCOL_VERSION).toBe(2);
    expect(MIN_SUPPORTED_GOSSIP_PROTOCOL).toBe(1);
    expect(isSupportedGossipDeltaProtocol(1)).toBe(true);
    expect(isSupportedGossipDeltaProtocol(2)).toBe(true);
    expect(isSupportedGossipDeltaProtocol(0)).toBe(false);
    expect(isSupportedGossipDeltaProtocol(3)).toBe(false);
  });

  it("defaults missing protocolVersion to 1", () => {
    expect(resolveGossipDeltaProtocolVersion(undefined)).toBe(
      DEFAULT_GOSSIP_DELTA_PROTOCOL_VERSION
    );
    expect(isSupportedGossipDeltaProtocol(undefined)).toBe(true);
  });
});
