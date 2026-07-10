import {
  isSupportedGossipDeltaProtocol,
  resolveGossipDeltaProtocolVersion,
} from "@wikitraveler/core";
import type { GossipDelta } from "@wikitraveler/core";

export function validateGossipDeltaProtocol(
  delta: GossipDelta
): { ok: true; protocolVersion: number } | { ok: false; message: string } {
  const protocolVersion = resolveGossipDeltaProtocolVersion(delta.protocolVersion);
  if (!isSupportedGossipDeltaProtocol(delta.protocolVersion)) {
    return {
      ok: false,
      message: `Unsupported gossip protocolVersion ${protocolVersion}`,
    };
  }
  return { ok: true, protocolVersion };
}
