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

Flow: search → tap property (or create if missing) → fill 12 accessibility fields → submit with JWT.

### `apps/lens`

Chrome MV3 extension. Injects a tier-coloured accessibility panel on Booking.com, Expedia, and Hotels.com. Also detects `<meta name="wt-property-id">` for first-party sites (no SDK required). No build step.

### `apps/registry`

Centralized node discovery service. Nodes call `POST /api/v1/nodes/register` on startup (via `REGISTRY_URL` env var) to appear in the mesh. Runs on port 3002.

| Endpoint | Description |
|----------|-------------|
| `POST /api/v1/nodes/register` | Register or heartbeat a node |
| `GET /api/v1/nodes` | List active nodes (filterable by region) |
| `GET /api/v1/nodes/:nodeId/peers` | Peer recommendations (up to 5, ordered by recency) |

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
NodePeer          ← peer registry with cached public key
GossipSnapshot    ← dedup log with SHA-256 hash of each applied delta

RegistryNode      ← in apps/registry DB
  nodeId       string UNIQUE
  url          string
  region       string?
  isActive     boolean
  lastHeartbeat DateTime
```

---

## Tier System

Every fact carries a tier. Merge logic always keeps the highest-ranking fact per `(property, field)`:

```
CONFIRMED (3) > VERIFIED (2) > AI_GUESS (1) > OFFICIAL (0)
```

**CONFIRMED promotion:** `evaluateConfirmed()` promotes a fact when ≥ 3 **distinct** human auditors (`submittedBy`) independently submit the same `(property, field, value)`. Counting auditors — not nodes — prevents gossip replication from auto-promoting a single person's fact.

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

Receiving nodes verify the RSA-SHA256 signature before accepting. Nodes without `NODE_PRIVATE_KEY` skip signing (local dev).

### Fallback — gossip cron (every 6 hours)

Catches any facts missed during unreachable push windows:

```
GET /api/cron/gossip
  → GET <REGISTRY_URL>/api/v1/nodes/:nodeId/peers
  → (falls back to local NodePeer table if registry unreachable)
  → for each peer: GET peer/api/gossip/snapshot?since=<lastSeen>
  → POST /api/gossip/ingest (applies delta locally)
  → upserts peer into local NodePeer table
```

### Node discovery

The central registry (`REGISTRY_URL`) is the authoritative peer source. At startup each node calls `POST <REGISTRY_URL>/api/v1/nodes/register` (fire-and-forget). The gossip cron queries `GET <REGISTRY_URL>/api/v1/nodes/:nodeId/peers` each run and falls back to the local `NodePeer` table if the registry is unreachable.

Any node also exposes identity endpoints used for HTTP Signature verification:
```
GET /.well-known/webfinger  →  { nodeId, version, publicKey, inboxUrl }
GET /api/nodeinfo           →  { nodeId, url, version, region, publicKey }
```

---

## AI Agent Flow

Three trigger paths:

1. **Photo upload** — `POST /api/properties/[id]/accessibility` fires `analyzePhotos()` in the background after saving the audit.
2. **On-demand** — `POST /api/properties/[id]/analyze` runs vision + gap-fill for one property.
3. **Nightly cron** — `GET /api/cron/ai-scan` gap-fills properties with no AI coverage (up to `?limit=20`).

AI never overwrites `VERIFIED` or `CONFIRMED` facts.

---

## Authentication

```
POST /api/auth/token  { passphrase }  →  { token: JWT (7-day) }

POST /api/properties/[id]/accessibility
  Authorization: Bearer <JWT>
```

Cron endpoints are protected by `Authorization: Bearer <CRON_SECRET>` (injected automatically by Vercel).

---

## API Surface

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/.well-known/webfinger` | — | Node identity + public key + inbox URL |
| GET | `/api/health` | — | Node status + fact/peer counts |
| GET | `/api/nodeinfo` | — | Node identity + RSA public key |
| POST | `/api/auth/token` | — | Exchange passphrase for JWT |
| GET | `/api/properties?q=` | — | Search properties |
| POST | `/api/properties` | JWT | Create property |
| GET | `/api/properties/[id]/accessibility` | — | Collapsed facts with tier |
| POST | `/api/properties/[id]/accessibility` | JWT | Submit audit (saves facts, triggers push + vision) |
| GET | `/api/properties/[id]/external-ids` | — | OSM/Wheelmap IDs |
| PATCH | `/api/properties/[id]/external-ids` | JWT | Set osmId/wheelmapId |
| POST | `/api/properties/[id]/external-ids` | JWT | Auto-discover Wheelmap node by bounding box |
| POST | `/api/properties/[id]/analyze` | JWT | On-demand AI analysis |
| POST | `/api/inbox` | Signature | Receive signed fact push from peer |
| GET | `/api/gossip/snapshot?since=` | — | Export delta for peer pull |
| POST | `/api/gossip/ingest` | — | Apply incoming delta |
| GET | `/api/nodes` | — | List active peers |
| POST | `/api/nodes` | — | Register peer |
| GET | `/api/cron/gossip` | CRON_SECRET | Gossip pull cycle + self-announce |
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
