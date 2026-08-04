/**
 * WikiTraveler protocol version constants.
 * Bump GOSSIP_PROTOCOL_VERSION on wire-level gossip changes (see docs/rfcs/).
 * Keep MIN_SUPPORTED_GOSSIP_PROTOCOL ≤ previous emit version for N↔N-1 mesh tests.
 */
export const GOSSIP_PROTOCOL_VERSION = 2;
export const MIN_SUPPORTED_GOSSIP_PROTOCOL = 1;
export const EXPORT_SCHEMA_VERSION = 2;

/** Default when older peers omit `protocolVersion` on GossipDelta. */
export const DEFAULT_GOSSIP_DELTA_PROTOCOL_VERSION = 1;

export function resolveGossipDeltaProtocolVersion(protocolVersion?: number): number {
  return protocolVersion ?? DEFAULT_GOSSIP_DELTA_PROTOCOL_VERSION;
}

export function isSupportedGossipDeltaProtocol(protocolVersion?: number): boolean {
  const v = resolveGossipDeltaProtocolVersion(protocolVersion);
  return v >= MIN_SUPPORTED_GOSSIP_PROTOCOL && v <= GOSSIP_PROTOCOL_VERSION;
}
