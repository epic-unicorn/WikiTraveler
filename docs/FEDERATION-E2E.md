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
| **Topology (Tier B)** | `pnpm gossip:tier-b` | `gossip-tier-b` | 3-node transitive discovery + H2 CORS, CONFIRMED honesty, peer resolve quality |
| **Client federation (Tier C)** | `pnpm gossip:tier-c` | `gossip-tier-b` (after Tier B) | Hub journey (home JWT → data node), `photoRefs` ingest ignore, Lens Origin allowlist |

Harness: Docker Compose gossip lab ([GOSSIP-DEV.md](./GOSSIP-DEV.md), `.github/workflows/gossip-compat.yml`). Tier B/C use the mesh-3 overlay (`docker-compose.gossip-mesh3.yml`).

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

### Tier B — Topology (CI job `gossip-tier-b`)

| Script | Asserts |
|--------|---------|
| `gossip:mesh-3` | Line A↔B↔C; A learns C via gossip `peers[]` without direct bootstrap; C’s evil `accessUrl` does **not** expand CORS on A (**H2**); trusted hub Origin is reflected |
| `gossip:confirmed` | Inbox with 3 distinct `submittedBy` + `sourceNodeId` → `CONFIRMED`; same auditor ×3 does not promote |
| `gossip:resolve` | Nested bboxes → smallest peer; equal area → nearer center; uncovered → `matched: "fallback"` home |

Orchestrator: `pnpm gossip:tier-b`. Lab: `pnpm dev:gossip-lab-mesh3`.

### Tier C — Client federation / RFC-0002 (M0–M5)

API-scripted on mesh-3 (Playwright Access UI still optional later). Mesh-3 keeps host-facing `NODE_URL` (`localhost:3000/3010/3020`); `GOSSIP_DEV` rewrites those to docker DNS for federated JWT pubkey fetch and inbox peer upsert. `CLIENT_ORIGINS` allowlists the lab Lens origin.

| Script | Asserts |
|--------|---------|
| `gossip:hub-journey` | Home A (non-covering) → JWT → resolve data B → `map?bbox=` + audit with home JWT; **H1** untrusted Origin blocked; **H5** `BBOX_REQUIRED` without bbox |
| `gossip:photos` | Audit + photo → snapshot `photoRefs`; cron pull peer tolerates / ignores photo fields |
| `gossip:lens-smoke` | Home login/resolve + data map/facts with `chrome-extension://wikitraveler-lab-lens` Origin |

Orchestrator: `pnpm gossip:tier-c`.

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
# Tier A (2-node)
pnpm dev:gossip-lab
pnpm gossip:discovery
pnpm gossip:hardening

# Tier B + C (3-node line topology)
pnpm dev:gossip-lab-mesh3
pnpm gossip:tier-b
pnpm gossip:tier-c
```

Individual Tier B scripts: `gossip:mesh-3`, `gossip:confirmed`, `gossip:resolve`.  
Individual Tier C scripts: `gossip:hub-journey`, `gossip:photos`, `gossip:lens-smoke`.

---

## Unit gaps (support E2E)

Prefer Vitest failures for merge/auth kernels; keep E2E for the live mesh:

- `packages/core/src/merge.ts` — `mergeGossipDelta`, `collapseFacts`, `evaluateConfirmed`
- Inbox body signature + `requireNodeAuth` replay window

---

## Priority

1. Tier A in CI — done  
2. Tier B in CI — done  
3. Tier C API suites in CI — done (this doc); optional Access Playwright UI later  
4. Tier D per-feature gates as M6 items land  
