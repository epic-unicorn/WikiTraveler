# Architecture

WikiTraveler is a federated truth layer for accessibility data — a mesh of independently operated nodes that share and corroborate facts contributed by field auditors.

---

## System Overview

```
┌──────────────────────────────────────────────────────────────┐
│                       Browser / Mobile                       │
│                                                              │
│  ┌──────────────┐  ┌────────────────┐  ┌──────────────────┐  │
│  │  Lens        │  │  Field Kit     │  │  Agency Website  │  │
│  │  (Chrome MV3)│  │  (Mobile PWA)  │  │  + SDK           │  │
│  └──────┬───────┘  └───────┬────────┘  └────────┬─────────┘  │
└─────────┼──────────────────┼───────────────────-┼────────────┘
          │ REST             │ REST               │ REST
          └──────────────────┴────────────────────┘
                                     │
                                     ▼
┌──────────────────────────────────────────────────────────────┐
│                    WikiTraveler Node                         │
│                (Next.js 14 App Router)                       │
│                                                              │
│  /api/properties   /api/gossip/*   /api/cron/*               │
│  /api/auth         /api/inbox      /api/nodes                │
│                                                              │
│  Prisma ORM → PostgreSQL                                     │
│  @wikitraveler/ai-agent → OpenAI GPT-4o (optional)           │
└─────────────────────────────┬────────────────────────────────┘
                              │ Gossip (pull + push)
                              ▼
              ┌───────────────────────────┐
              │  Other WikiTraveler Nodes │
              └───────────────────────────┘
```

---

## Components

### `apps/node`

The canonical deployment unit. A Next.js 14 App Router app serving:
- **REST API** under `/api/` — used by all clients and the SDK
- **Dashboard** at `/` — properties with tier breakdown
- **Property page** at `/properties/[id]` — audit form + fact history
- **Gossip cron** at `/api/cron/gossip` — polls peers, ingests deltas, self-announces

### `apps/field-kit`

Mobile-optimised Next.js app. Opens on the auditor's phone in the hotel lobby. Connects to any node via `NEXT_PUBLIC_NODE_API_URL`.

Flow: search → GPS resolution (auto-detects the nearest regional node via `/api/peers/resolve`) → tap property (or create if missing) → fill 12 accessibility fields → submit with JWT. If the property lives on a different node than the user's home node, the JWT is verified remotely via `/.well-known/pubkey` cross-node — no re-login required.

### `apps/lens`

Chrome MV3 extension. Injects a tier-coloured accessibility panel on Booking.com, Expedia, and Hotels.com. Also detects `<meta name="wt-property-id">` for first-party sites (no SDK required). No build step.

### `apps/agency-demo`

Single `index.html` demonstrating the three SDK integration patterns: drop-in widget, raw JSON fetch, and ESM import. Auto-populates a property dropdown from the node's `/api/properties`.

### `packages/core`

Framework-agnostic logic shared by every other package. No browser or Node runtime dependencies.

| Export | Description |
|--------|-------------|
| `Tier` enum | `OFFICIAL \| AI_GUESS \| VERIFIED \| CONFIRMED` |
| `SourceType` enum | `WIKIDATA \| WHEELMAP \| WHEEL_THE_WORLD \| AUDITOR` |
| `TIER_RANK / TIER_LABEL / TIER_COLOR` | Rank, label, and CSS colour maps |
| `ACCESSIBILITY_FIELDS` | Array of 12 field names |
| `collapseFacts()` | Keeps the highest-tier fact per field |
| `evaluateConfirmed()` | Promotes to `CONFIRMED` when ≥ 3 distinct auditors agree |
| `mergeGossipDelta()` | Applies an incoming delta to a local fact set |

### `packages/sdk`

Browser SDK distributed in three formats:

| Format | File | Use case |
|--------|------|----------|
| ESM | `dist/index.mjs` | Vite / Webpack |
| CJS | `dist/index.js` | Node.js bundlers |
| UMD | `dist/wikitraveler.umd.js` | `<script>` tag |

Key exports: `WikiTraveler` class (REST API wrapper), `mountWidget()` (DOM widget), `autoMount()` (scan page for `[data-wt-widget]` and mount).

### `packages/ai-agent`

Isolates all OpenAI calls. Swap the AI provider by changing only this package.

| Export | Input | Output |
|--------|-------|--------|
| `analyzePhotos()` | Up to 3 base64 images | `AgentFact[]` from GPT-4o Vision |
| `gapFill()` | Property name + location + covered fields | `AgentFact[]` from GPT-4o text |

AI facts are tagged `AI_GUESS` and are always overwritten by human audits. The entire feature disables silently when `OPENAI_API_KEY` is absent.

---

## Data Model

```
Property
  canonicalId  string UNIQUE   ← Wikidata Q-identifier or local:* for created properties
  name         string
  location     string
  osmId        string?          ← linked OpenStreetMap node
  wheelmapId   string?          ← linked Wheelmap node

AccessibilityFact
  propertyId   FK → Property
  fieldName    string
  value        string
  tier         OFFICIAL | AI_GUESS | VERIFIED | CONFIRMED
  sourceType   WIKIDATA | WHEELMAP | WHEEL_THE_WORLD | AUDITOR
  sourceNodeId string           ← originating node
  submittedBy  string?          ← auditor identifier (used for CONFIRMED promotion)
  UNIQUE (propertyId, fieldName, sourceNodeId)

AuditSubmission   ← raw submitted facts + photos (base64)
NodePeer          ← peers with cached publicKey, bbox, region
GossipSnapshot    ← dedup log with SHA-256 hash of each applied delta
User              ← local user accounts (username + bcrypt hash)
```

---

## Tier System

Every fact carries a tier. Merge logic always keeps the highest-ranking fact per `(property, field)`:

```
CONFIRMED (3) > VERIFIED (2) > AI_GUESS (1) > OFFICIAL (0)
```

**CONFIRMED promotion:** `evaluateConfirmed()` promotes a fact when ≥ 3 **distinct** human auditors (`submittedBy`) independently submit the same `(property, field, value)`. Counting auditors — not nodes — prevents gossip replication from auto-promoting a single person's fact.

---

## Authentication

Users register per-node (`POST /api/auth/register`) and log in (`POST /api/auth/login`) to receive an **RS256 JWT** signed with the node's `NODE_PRIVATE_KEY`. The JWT payload includes `homeNodeUrl` — the issuing node's URL.

Any node accepting the JWT decodes `homeNodeUrl`, fetches the issuer's public key from `GET homeNodeUrl/.well-known/pubkey`, and verifies the signature locally. No shared secrets needed — user identity is `username@homeNodeUrl` and is globally unique across the mesh.

---

## Federation & Gossip

Two complementary propagation paths:

### Fast path — real-time push

After every successful field audit, the receiving node pushes the new facts to all active peers' `/api/inbox`:

```
POST /api/properties/[id]/accessibility
  → saves VERIFIED facts
  → pushFactsToPeers() (fire-and-forget, parallel)
       → POST peer/api/inbox  { fromNodeId, properties[], facts[] }
            X-WikiTraveler-Signature: keyId="...", signature="..."
```

Receiving nodes verify the RSA-SHA256 signature before accepting.

### Fallback — gossip cron (every 6 hours)

Catches any facts missed during unreachable push windows:

```
GET /api/cron/gossip
  → reads active peers from local NodePeer table
  → for each peer: GET peer/api/gossip/snapshot?since=<lastSeen>
       → POST /api/gossip/ingest (applies delta + upserts incoming peers)
  → upserts peer into local NodePeer table
```

### Peer discovery

Nodes discover each other organically — no central registry needed:

1. **Bootstrap** — on startup, `lib/bootstrap.ts` contacts each `BOOTSTRAP_PEERS` URL, fetches `/api/nodeinfo`, and upserts that node + its known peers into the local `NodePeer` table (one-hop expansion).
2. **Gossip peer exchange** — every gossip delta includes the sender’s known peer list (`peers[]`). Recipients upsert all new peers automatically.
3. **Peer resolution** — `GET /api/peers/resolve?lat=&lon=` returns the best-matching peer for a coordinate based on stored `bbox` fields. Clients use this for automatic regional routing.

Identity endpoints exposed by every node:
```
GET /api/nodeinfo           → { nodeId, url, version, region, bbox, publicKeyPem, peers[] }
GET /.well-known/pubkey     → { publicKeyPem }
GET /api/peers              → { peers[] }
GET /api/peers/resolve      → { nodeId, url, region, bbox, matched }
```

`REGISTRY_URL` is still accepted as a legacy bootstrap seed source but is not required.

---

## AI Agent Flow

Three trigger paths:

1. **Photo upload** — `POST /api/properties/[id]/accessibility` fires `analyzePhotos()` in the background after saving the audit.
2. **On-demand** — `POST /api/properties/[id]/analyze` runs vision + gap-fill for one property.
3. **Nightly cron** — `GET /api/cron/ai-scan` gap-fills properties with no AI coverage (up to `?limit=20`).

AI never overwrites `VERIFIED` or `CONFIRMED` facts.

## Authentication

Users register per-node (`POST /api/auth/register`) and log in (`POST /api/auth/login`) to receive an **RS256 JWT** signed with the node's `NODE_PRIVATE_KEY`. The JWT payload includes `homeNodeUrl` — the issuing node's URL.

Any node accepting the JWT decodes `homeNodeUrl`, fetches the issuer's public key from `GET homeNodeUrl/.well-known/pubkey`, and verifies the signature locally. No shared secrets needed — user identity is `username@homeNodeUrl` and is globally unique across the mesh.

This means a user registered on Node A can submit audits to Node B (e.g. while travelling) without creating a second account.

Cron endpoints are protected by `Authorization: Bearer <CRON_SECRET>` (injected automatically by Vercel).

---

## API Surface

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/health` | — | Node status + fact/peer counts |
| GET | `/api/nodeinfo` | — | Node identity, public key, bbox, peers |
| GET | `/.well-known/pubkey` | — | RS256 public key PEM for remote JWT verification |
| POST | `/api/auth/register` | — | Create user account |
| POST | `/api/auth/login` | — | Login; returns RS256 JWT |
| GET | `/api/auth/me` | JWT | Current user info |
| POST | `/api/auth/token` | — | **Deprecated** — passphrase JWT (backward compat) |
| GET | `/api/peers` | — | List active peers |
| GET | `/api/peers/resolve?lat=&lon=` | — | Best-matching peer for a coordinate |
| GET | `/api/properties?q=` | — | Search properties |
| POST | `/api/properties` | JWT | Create property |
| GET | `/api/properties/[id]/accessibility` | — | Collapsed facts with tier |
| POST | `/api/properties/[id]/accessibility` | JWT | Submit audit (saves facts, triggers push + vision) |
| POST | `/api/properties/[id]/analyze` | JWT | On-demand AI analysis |
| POST | `/api/inbox` | Signature | Receive signed fact push from peer |
| GET | `/api/gossip/snapshot?since=` | — | Export delta for peer pull |
| POST | `/api/gossip/ingest` | — | Apply incoming delta |
| GET | `/api/cron/gossip` | CRON_SECRET | Gossip pull cycle |
| GET | `/api/cron/ai-scan` | CRON_SECRET | Batch gap-fill |
| GET | `/api/cron/wheelmap-sync` | CRON_SECRET | Sync OSM wheelchair data |

---

## Technology Choices

| Concern | Choice | Rationale |
|---------|--------|-----------|
| Framework | Next.js 14 App Router | API routes + SSR in one deployment unit |
| ORM | Prisma 5 | Type-safe, migration-first, works with Vercel Postgres |
| Auth | JWT (jsonwebtoken) | Stateless, no session store |
| Gossip | HTTP pull + signed push | Cron safety net + real-time push after each audit |
| Push signing | RSA-SHA256 (HTTP Signatures) | Stateless, no PKI authority; keys via WebFinger |
| AI provider | OpenAI GPT-4o | Best-in-class vision + JSON mode; swappable via ai-agent |
| Photo storage | base64 in DB | No object-storage dependency for MVP |
| Extension | Chrome MV3 vanilla JS | No build step; load unpacked |
| SDK bundling | tsup (esbuild) | Fast, dual CJS+ESM+UMD from one config |
| Monorepo | pnpm workspaces | Fast installs, strict isolation |
