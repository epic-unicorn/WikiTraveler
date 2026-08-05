# Compatibility matrix

Cross-version behaviour for WikiTraveler nodes in a federated mesh.

**Related:** [Releases](./RELEASES.md) · [Upgrade](./UPGRADE.md) · [versions.json](../versions.json) · [RFC-0001](./rfcs/0001-gossip-protocol-2.md)

---

## Supported skew policy

| Relationship | Supported? | Notes |
|--------------|------------|-------|
| Node **N** ↔ Node **N** | Yes | Baseline |
| Node **N** ↔ Node **N-1** (previous minor) | Yes | Default policy |
| Node **N** ↔ Node **N-2** or older | Best effort | Not tested; upgrade recommended |
| Access **N** → Node **N** or **N-1** | Yes | Client checks `/api/health` version |
| Lens / SDK → Node **N** or **N-1** | Yes | REST API backward compatible |
| Access with viewport map (RFC-0002 M3) → Node without `map?bbox=` | No | Redeploy **Node + Access** together; unscoped `/api/properties/map` is rejected |

Maintainers test **same-version discovery** and **N ↔ N-1** in CI ([gossip-compat](../.github/workflows/gossip-compat.yml)).

---

## Protocol versions

| Constant | Current | Breaking bump when |
|----------|---------|------------------|
| `gossipProtocol` | `2` | Gossip delta JSON incompatible |
| `minGossipProtocol` | `1` | Dropping support for older deltas |
| `exportSchema` | `2` | Admin backup gzip shape incompatible |
| Node runtime (`version`) | See [versions.json](../versions.json) | Independent of gossip protocol |

Exposed on `GET /api/nodeinfo`:

```json
{
  "version": "0.3.0",
  "gossipProtocol": 2,
  "minGossipProtocol": 1,
  "exportSchema": 2
}
```

---

## Release compatibility matrix

| From → To | DB migrate? | Gossip safe? | Access redeploy? | Operator doc |
|-----------|-------------|--------------|------------------|--------------|
| 0.2.0 → 0.2.x patch | Usually no | Yes | Only if client changed | [UPGRADE.md](./UPGRADE.md) |
| 0.2.x → 0.3.0 minor | If changelog says yes | Yes (additive) | If API contract changed | [UPGRADE.md](./UPGRADE.md) |
| 0.x → 1.0.0 major | Yes | Read release notes | Likely yes | [CHANGELOG.md](../CHANGELOG.md) |

Update this table on every minor/major release.

---

## Gossip field compatibility

### Protocol 1 (accepted; default when `protocolVersion` omitted)

| Field | Required? | Introduced | Older peers |
|-------|-----------|------------|-------------|
| `fromNodeId` | Yes | v0.1 | Must have |
| `facts[]` | Yes | v0.1 | Must have |
| `properties[]` | Yes | v0.1 | Must have |
| `metadataOverrides` | No | v0.2 | Ignored if absent |
| `peers[]` | No | v0.2 | Ignored if absent |
| `photoRefs` | No | v0.2+ | Ignored if absent |
| `protocolVersion` | No | v0.2+ (Phase 4) | Defaults to `1` when absent |

### Protocol 2 (current emit — [RFC-0001](./rfcs/0001-gossip-protocol-2.md))

| Field | Required? | Notes |
|-------|-----------|-------|
| `protocolVersion` | Emitted as `2` | Still optional on the wire; receivers accept `1`…`2` |
| `peers[].gossipProtocol` | No | Capability hint for discovery |
| `peers[].version` | No | Runtime version hint |

No production public mesh existed at the protocol 2 cut — future breaks may raise `minGossipProtocol` with a short sunset when maintainers agree (still document via RFC + CHANGELOG).

---

## What breaks federation

| Change | Symptom | Prevention |
|--------|---------|------------|
| Deploy code before `db:deploy` | 500 on ingest/API | Migrate first — [UPGRADE.md](./UPGRADE.md) |
| Remove gossip field | Partial sync | Additive-only for one minor cycle |
| Require new auth header | 401 between peers | Document sunset in CHANGELOG |
| Change merge/tier rules | Different effective facts | RFC + compatibility test |

---

## Export / import schema

| `schemaVersion` | Status | Import support |
|-----------------|--------|----------------|
| `1` | Legacy | Still imported (no `metadataOverrides`) |
| `2` | Current | Full backup including overrides |

---

## Client minimum node version

| Client | Min node | Check |
|--------|----------|-------|
| WikiTraveler Access | Same major as client | `NEXT_PUBLIC_APP_VERSION` vs `/api/health` |
| Lens | 0.2.0+ | Documented per Lens release |
| SDK | 0.2.0+ | Documented per SDK release |

Phase 5: Access shows a warning when node version is below minimum.
