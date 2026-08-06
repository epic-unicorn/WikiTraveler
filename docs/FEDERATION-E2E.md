# Federation & gossip end-to-end tests

**Docs:** [Gossip lab](./GOSSIP-DEV.md) · [Architecture](./ARCHITECTURE.md) · [Compatibility](./COMPATIBILITY.md) · [RFC-0002](./rfcs/0002-global-hub-access.md) · [Roadmap](./ROADMAP.md)

Advanced E2E coverage so federation and gossip keep working as hub Access, photos, CONFIRMED honesty, and other mesh features land.

---

## What CI proves today

| Suite | Command | Job | Proves |
|-------|---------|-----|--------|
| Discovery | `pnpm gossip:discovery` | `gossip-discovery` | Organic `BOOTSTRAP_PEERS`, pubkey, seed → cron pull, property/fact counts, snapshot protocol |
| N↔N-1 compat | `pnpm gossip:compat` | `gossip-compat` | Mixed runtime version strings + sync |
| **Hardening (Tier A)** | `pnpm gossip:hardening` | `gossip-discovery` (after discovery) | Push + pull dual-path, auth negatives, override CRUD, OSM re-ingest survival, bbox filter |

Harness: Docker Compose gossip lab ([GOSSIP-DEV.md](./GOSSIP-DEV.md), `.github/workflows/gossip-compat.yml`).

---

## Tiers

### Tier A — Mesh kernel (every PR that touches gossip / auth / merge)

| Script | Asserts |
|--------|---------|
| `gossip:dual-path` | Metadata override reaches peer via **inbox push** (no cron); after delete on B, **cron pull** restores it; second pull is idempotent |
| `gossip:auth-negative` | Missing/bad inbox body sig → 401; missing/stale/unknown/bad node auth on snapshot → 401; valid signed snapshot → 200 |
| `gossip:bbox-identity` | Out-of-bbox property + override on A does not appear on B after sync; same `canonicalId` remaps across local IDs |
| `gossip:crud` | Override create → sync → effective metadata on B; reset → base returns |
| `gossip:reingest` | Manual overrides survive `/api/dev/reingest` on both nodes |

Orchestrator: `pnpm gossip:hardening` (runs the five above in order).

### Tier B — Topology (nightly or protocol/peer PRs)

| Suite | Goal |
|-------|------|
| `gossip:mesh-3` *(planned)* | A↔B, B↔C → A learns C via `peers[]` without in-bbox facts; gossiped `accessUrl` does not expand CORS (**H2**) |
| `gossip:resolve` *(planned)* | Nested bboxes → smallest containing; equal area → nearest center; uncovered → no wrong home dump |
| `gossip:confirmed` *(planned)* | ≥3 distinct `submittedBy` → `CONFIRMED`; same auditor gossiped N times does not inflate |

### Tier C — Client federation / RFC-0002 (before M6 ships)

| Suite | Goal |
|-------|------|
| Access Playwright hub journey *(planned)* | Login home → resolve data node → `map?bbox=` → audit with home JWT → fact on data node; untrusted Origin blocked (**H1**); Access↔node map skew (**H5**) |
| `gossip:photos` *(planned)* | `photoRefs` in deltas; fetchable evidence URLs; N↔N-1 ignores unknown photo fields |
| Lens background fetch smoke *(planned)* | Home auth/resolve + data facts with allowlisted extension origin |

### Tier D — Feature-gated hardening

| Upcoming work | Keep green |
|---------------|------------|
| Multi-node viewport fan-out | Pins only from covering nodes |
| Shorter JWT TTL | Expired home JWT rejected on data node |
| Admin peer client-origin UI | Unapproved gossiped origin still blocked |
| Protocol / `minGossipProtocol` bump | Compat + sunset assertions |
| Offline Access queue | Replay → single fact, no double-count |

**Doc/code note:** Architecture mentions snapshot `?since=`; cron currently pulls a full snapshot when `since` is omitted. Prefer implementing incremental pull + asserting a cheap second sync, or align the docs until then.

---

## Local usage

```bash
pnpm dev:gossip-lab          # Node A :3000, Node B :3010
# Complete /setup + Eindhoven region on both, or rely on seed (sets bbox)
pnpm gossip:discovery        # baseline
pnpm gossip:hardening        # Tier A
```

Individual scripts: `gossip:dual-path`, `gossip:auth-negative`, `gossip:bbox-identity`, `gossip:crud`, `gossip:reingest`.

---

## Unit gaps (support E2E)

Prefer Vitest failures for merge/auth kernels; keep E2E for the live mesh:

- `packages/core/src/merge.ts` — `mergeGossipDelta`, `collapseFacts`, `evaluateConfirmed`
- Inbox body signature + `requireNodeAuth` replay window

---

## Priority

1. Tier A in CI (this doc + scripts) — highest ROI for every future feature  
2. Hub Access Playwright — locks RFC-0002 before M6  
3. Mesh-3 + CONFIRMED + photos — before those features ship  
4. True binary N-1 image in compat (not only version-string overlay) when upgrade skew matters  
