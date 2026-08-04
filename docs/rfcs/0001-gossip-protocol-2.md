# RFC-0001: Gossip protocol version 2

**Status:** Accepted (Phase 6 — no public production mesh yet)  
**Area:** Gossip / protocol

## Summary

Raise the emitted `GossipDelta.protocolVersion` from `1` to `2`. Keep `MIN_SUPPORTED_GOSSIP_PROTOCOL = 1` so N↔N-1 CI (current ↔ `0.1.0`) remains green. Add optional `gossipProtocol` / `version` on peer-exchange entries so discovery carries capability hints without a breaking JSON shape.

## Motivation

Protocol `1` shipped additive optional fields (`metadataOverrides`, `peers`, `photoRefs`, `protocolVersion`) without an emit bump. Before public nodes appear, establish a clear current wire version and document the RFC path for future breaks.

## Proposal

1. `GOSSIP_PROTOCOL_VERSION = 2` in `@wikitraveler/core`.
2. Snapshots continue to include optional fields; peers older than v0.2 ignore unknown keys.
3. `PeerInfo` may include `gossipProtocol` and `version` (both optional).
4. Ingest upserts peer exchange even when the delta has no in-bbox facts (discovery must not depend on regional audits).

## Compatibility

- Gossip protocol bump? Emit `2`, min still `1`.
- Requires DB migrate before deploy? No.
- Old clients still work? Yes — N-1 omits new peer fields; protocol `1` deltas still accepted.

## Alternatives

- Wait until first public node — rejected; harder to break later.
- Raise `MIN_SUPPORTED` to `2` immediately — rejected while CI still mixes with `0.1.0`.
