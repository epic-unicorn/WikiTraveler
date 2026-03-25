# Architecture

WikiTraveler is a federated, horizontally-scalable truth layer for travel data. This document explains how the pieces fit together.

---

## System Overview

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          Browser / Mobile                                │
│                                                                          │
│   ┌─────────────┐   ┌──────────────────┐   ┌──────────────────────────┐  │
│   │  Lens       │   │  Field Kit       │   │  Agency Website          │  │
│   │  (Chrome    │   │  (Mobile PWA)    │   │  + WikiTraveler SDK      │  │
│   │   MV3)      │   │                  │   │  (UMD / ESM / CJS)       │  │
│   └──────┬──────┘   └────────┬─────────┘   └──────────────┬───────────┘  │
│          │                   │                            │              │
└──────────┼───────────────────┼────────────────────────────┼──────────────┘
           │  REST             │  REST                      │  REST
           └───────────────────┴────────────────────────────┘
                                          │
                                          ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                        WikiTraveler Node                                 │
│                     (Next.js 14 App Router)                              │
│                                                                          │
│  ┌──────────────┐  ┌────────────────┐  ┌──────────────────────────────┐  │
│  │  /api/       │  │  /api/gossip/  │  │  /api/cron/gossip            │  │
│  │  properties  │  │  snapshot      │  │  /api/cron/ai-scan           │  │
│  │  /analyze    │  │  ingest        │  │  (Vercel Cron / Docker loop) │  │
│  │  /auth       │  └───────┬────────┘  └───────────┬──────────────────┘  │
│  └──────────────┘          │ Gossip pull           │ AI cron             │
│                            │                       │                     │
│  ┌──────────────────────────────────────────────┐  │                     │
│  │  Prisma ORM                                  │  │                     │
│  │  Property | AccessibilityFact | NodePeer     │  │                     │
│  │  AuditSubmission | GossipSnapshot            │  │                     │
│  └──────────────────────┬───────────────────────┘  │                     │
│                         │                          │                     │
│   ┌────────────────────────────────────────────────┘                     │
│   │                                                                      │
│   ▼                                                                      │
│  ┌─────────────────────────┐                                             │
│  │  @wikitraveler/ai-agent │                                             │
│  │  analyzePhotos()        │──────── OpenAI API (GPT-4o) ──────────────► │
│  │  gapFill()              │                                             │
│  └─────────────────────────┘                                             │
│                         │                                                │
└─────────────────────────┼────────────────────────────────────────────────┘
                          │
          ┌───────────────┴────────────┐
          ▼                            ▼
 ┌─────────────────┐        ┌───────────────────┐
 │  PostgreSQL 16  │        │  OpenAI (GPT-4o)  │
 └─────────────────┘        └───────────────────┘

        ◄──── Gossip pull (delta sync) ─────►

 ┌───────────────────┐          ┌───────────────────┐
 │  Node A           │◄────────►│  Node B           │
 │  (Vercel / Docker)│          │  (Vercel / Docker)│
 └───────────────────┘          └───────────────────┘
```

---

## Components

### `apps/node` — The Truth Station

The canonical WikiTraveler deployment unit. It is a **Next.js 14 App Router** application with:

- A **REST API** under `/api/` used by all other apps and the SDK.
- A **server-rendered dashboard** at `/` showing properties and their tier breakdown.
- A **per-property audit page** at `/properties/[id]` with an embedded audit form.
- A **gossip cron endpoint** at `/api/cron/gossip` that polls peers and ingests their deltas.

Key libraries: Next.js 14, Prisma 5, jsonwebtoken.

### `apps/field-kit` — Mobile Audit App

A separate Next.js app optimised for mobile screens. Auditors open it on their phone while standing in a hotel lobby. It connects to any node via `NEXT_PUBLIC_NODE_API_URL`.

- Property search page → drill into a property → fill out the 12-field accessibility form → optionally attach up to 3 photos (stored as base64).
- Requires a valid `COMMUNITY_PASSPHRASE` JWT to submit.

### `apps/lens` — Browser Extension

A Chrome Manifest V3 extension that injects accessibility data onto booking sites (Booking.com, Expedia, Hotels.com).

- `content.js` — extracts the property ID from the URL or page title, fetches data from the configured node, and injects a floating panel with tier-coloured badges.
- `popup.html/js` — shows a fact table for the current tab.
- `options.html/js` — lets the user configure which node URL to use.
- `background.js` — service worker that handles `GET_NODE_URL` messages from `content.js`.

No build step required. Load `apps/lens/` directly as an unpacked extension.

### `apps/agency-demo` — SDK Integration Demo

A self-contained static HTML page that demonstrates three integration patterns:

1. **Drop-in widget** — add `data-wt-widget` to any element.
2. **Raw JSON fetch** — call the API directly and render your own UI.
3. **npm ESM import** — import `WikiTraveler` and `mountWidget` from `@wikitraveler/sdk`.

The demo loads the UMD bundle from `packages/sdk/dist/wikitraveler.umd.js` and includes a live node-URL switcher.

### `packages/core` — Shared Logic

Framework-agnostic TypeScript library used by every other package. Never has runtime browser or Node dependencies — only pure logic.

**Exports:**

| Symbol | Description |
|--------|-------------|
| `Tier` enum | `OFFICIAL \| AI_GUESS \| VERIFIED \| CONFIRMED` |
| `SourceType` enum | `WIKIDATA \| WHEELMAP \| WHEEL_THE_WORLD \| AUDITOR` |
| `TIER_RANK` | Numeric rank map for comparison |
| `TIER_LABEL` | Human-readable label map |
| `TIER_COLOR` | CSS hex colour map |
| `ACCESSIBILITY_FIELDS` | Array of 12 field names |
| `pickWinningFact()` | Returns the higher-tier fact between two |
| `collapseFacts()` | Collapses an array of facts to one winner per field |
| `evaluateConfirmed()` | Promotes facts to `CONFIRMED` when ≥ 3 **distinct human auditors** (`submittedBy`) agree |
| `mergeGossipDelta()` | Applies an incoming gossip delta to a local fact set |

### `packages/sdk` — Agency Browser SDK

TypeScript library distributed in three formats:

| Format | File | Use case |
|--------|------|----------|
| CJS | `dist/index.js` | Node.js / CommonJS bundlers |
| ESM | `dist/index.mjs` | Modern bundlers (Vite, Webpack 5) |
| UMD/IIFE | `dist/wikitraveler.umd.js` | `<script>` tag on any page |

**`WikiTraveler` class** — wraps the node REST API with typed methods and configurable timeout.

**`mountWidget()`** — pure DOM widget that renders a tier-coloured accessibility panel into any element.

**`autoMount()`** — scans the page for `[data-wt-widget]` elements and mounts automatically; re-runs on DOMContentLoaded.

### `packages/ai-agent` — AI Analysis Engine

Isolated TypeScript package that encapsulates all OpenAI interactions. The node depends on it; no other package does. This means the AI provider can be swapped (e.g. Anthropic Claude) by changing only this package.

**Two capabilities:**

| Export | Input | Output | Model |
|--------|-------|--------|-------|
| `analyzePhotos(photos, apiKey)` | Up to 3 base64/data-URI images | `AgentFact[]` with `high`/`medium` confidence | GPT-4o Vision |
| `gapFill(name, location, existingFields, apiKey)` | Property name, location, list of already-covered field names | `AgentFact[]` always `low` confidence | GPT-4o |

**`AgentFact`:**
```typescript
{
  fieldName: string;        // one of ACCESSIBILITY_FIELDS
  value: string;            // estimated value
  confidence: "high" | "medium" | "low";
  evidence: string;         // one-sentence rationale, stored in signatureHash
}
```

**Prompt design:**
- Vision prompt instructs the model to only report fields with visible evidence. It never guesses for non-visible fields.
- Gap-fill prompt is given the list of already-covered fields and is instructed to skip them entirely, preventing AI from overwriting better data.
- Both prompts use `response_format: { type: "json_object" }` to guarantee parseable output.

**Safety guarantees:**
- `COMMUNITY` and `MESH_TRUTH` facts are never overwritten by `AI_GUESS`.
- AI facts are tagged with `sourceNodeId: "{NODE_ID}:ai-agent"` keeping them distinct from human audits in the gossip mesh.
- Evidence and confidence are stored in `signatureHash` as JSON for a full audit trail.
- The entire feature silently disables when `OPENAI_API_KEY` is absent.

---

## Data Model

```
Property
  id          cuid  PK
  canonicalId string UNIQUE   ← Wikidata Q-identifier (e.g. Q610297)
  name        string
  location    string
  osmId       string? UNIQUE   ← linked OpenStreetMap node ID
  wheelmapId  string? UNIQUE   ← linked Wheelmap node ID

AccessibilityFact
  id            cuid PK
  propertyId    FK → Property
  fieldName     string
  value         string
  tier          Tier enum      ← OFFICIAL | AI_GUESS | VERIFIED | CONFIRMED
  sourceType    SourceType     ← WIKIDATA | WHEELMAP | WHEEL_THE_WORLD | AUDITOR
  sourceNodeId  string          ← which node originated this fact
  submittedBy   string?         ← human auditor identifier (used for CONFIRMED promotion)
  signatureHash string?
  timestamp     DateTime
  UNIQUE (propertyId, fieldName, sourceNodeId)

AuditSubmission
  id           cuid PK
  propertyId   FK → Property
  auditorToken string          ← hashed JWT sub
  facts        Json            ← raw submitted facts
  photoUrls    Json            ← base64 images array

NodePeer
  id        cuid PK
  url       string UNIQUE
  publicKey string?          ← cached RSA public key PEM (for HTTP Signature verification)
  lastSeen  DateTime
  isActive  boolean

GossipSnapshot
  id           cuid PK
  fromNodeId   string
  snapshotHash string          ← SHA-256 of the serialised delta
  appliedAt    DateTime
  factCount    int
```

---

## Reliability Tier System

Every `AccessibilityFact` carries a `tier`. The merge logic always keeps the **highest-ranking** fact for any given `(property, field)` combination:

```
CONFIRMED (3) > VERIFIED (2) > AI_GUESS (1) > OFFICIAL (0)
```

### CONFIRMED Promotion

`evaluateConfirmed()` in `packages/core` inspects all facts for a given `(propertyId, fieldName, value)` triplet. If **≥ 3 distinct human auditors** (`submittedBy`) have independently submitted the same value, that fact is promoted to `CONFIRMED`. This threshold is configurable (default 3).

> **Why auditors, not nodes?** Counting `sourceNodeId` (nodes that hold a copy) would be gamed automatically by gossip replication — a single auditor's fact gossipped to three nodes would self-promote. Counting distinct `submittedBy` values ensures `CONFIRMED` always means three independent people verified the same thing on the ground.

---

## Federation & Gossip Protocol

WikiTraveler combines two complementary propagation paths: a **real-time push** (fast path) and a **pull-based gossip cron** (safety net).

### Fast path — ActivityPub-inspired push

Every time a field auditor submits a `VERIFIED` fact, the receiving node immediately pushes it to all active peers' `/api/inbox` endpoint. This is inspired by Mastodon's ActivityPub inbox model, adapted for structured measurement data.

```
Auditor submits POST /api/properties/[id]/accessibility
  │
  ├─ saves VERIFIED facts locally
  │
  └─ pushFactsToPeers()  (fire-and-forget, parallel)
       │
       └─ for each active peer:
            POST peer/api/inbox
              headers: X-WikiTraveler-Signature: keyId="...",signature="..."
              body: { fromNodeId, fromNodeUrl, properties[], facts[] }

Peer receives POST /api/inbox
  │
  ├─ parse X-WikiTraveler-Signature header
  ├─ look up sender public key (NodePeer.publicKey cache, or fetch live from /api/nodeinfo)
  ├─ RSA-SHA256 verify signature
  ├─ upsert properties (FK safety)
  └─ mergeGossipDelta → upsert facts
```

### Fallback — pull-based gossip cron

The gossip cron runs every 6 hours and catches any facts that were missed (e.g. a peer was temporarily unreachable during the push). It also triggers a self-announce to any peers that responded, ensuring bidirectional discovery.

```
Node A (cron fires)
  │
  ├─ GET /api/nodes          (list active peers)
  │
  └─ for each peer B:
       GET B/api/gossip/snapshot?since=<lastSeen ISO timestamp>
         returns: { facts: AccessibilityFact[], properties[], fromNodeId, generatedAt }
       │
       POST /api/gossip/ingest  (local, applies delta)
         ├─ upserts properties[] first (FK safety)
         ├─ runs mergeGossipDelta (core)
         ├─ upserts winning facts
         ├─ re-evaluates CONFIRMED tier
         └─ records GossipSnapshot with SHA-256 hash
       │
       POST B/api/nodes  { url: NODE_URL }  (self-announce to peer)
```

### Delta Snapshot format

`GET /api/gossip/snapshot?since=<ISO>` returns only facts **and properties** created or updated after the `since` timestamp. Including properties in the delta prevents FK violations when a bootstrapping node receives its first sync.

### Node discovery

New nodes bootstrap from the `BOOTSTRAP_PEERS` environment variable (comma-separated URLs). On each peer's `/` there is also a standard WebFinger endpoint:

```
GET /.well-known/webfinger
  → { subject, links: [{ rel: "self", href: "/api/nodeinfo" }, { rel: "inbox", href: "/api/inbox" }],
      properties: { nodeId, version, publicKey } }
```

Any tool or human operator can hit `/.well-known/webfinger` on a known node to discover its inbox URL and public key without any prior configuration.

### HTTP Signatures

Outgoing inbox pushes are signed with the node's RSA private key (`NODE_PRIVATE_KEY`). Receiving nodes verify the signature before accepting any data:

1. Sender signs the raw JSON body with RSA-SHA256.
2. Signature is sent in `X-WikiTraveler-Signature: keyId="<NODE_URL>",algorithm="rsa-sha256",signature="<base64>"`.
3. Receiver parses `keyId` to find the sender's public key — first from `NodePeer.publicKey` cache, then by fetching `/api/nodeinfo` on the sender.
4. Receiver verifies the signature. Mismatch → `401`.

Nodes without `NODE_PRIVATE_KEY` (e.g. local dev) silently skip the push. The gossip cron remains fully functional without signing.

### Cron schedule

- **Vercel gossip** — configured in `vercel.json`, runs every 6 hours (`0 */6 * * *`).
- **Vercel AI scan** — configured in `vercel.json`, runs daily at 02:00 (`0 2 * * *`).
- **Vercel Wheelmap sync** — runs daily at 03:00 (`0 3 * * *`), syncs OSM wheelchair data.
- **Docker** — the two-node gossip demo uses a lightweight `gossip-scheduler` container that runs `curl` in a loop every 10 seconds (demo mode).

---

## AI Agent Flow

The AI agent is triggered in three ways:

### 1. Background vision (photo upload)

When a field auditor submits photos via the Field Kit:

```
POST /api/properties/[id]/accessibility  { facts: [...], photoUrls: ["<base64>", ...] }
  │
  ├─ stores AuditSubmission + COMMUNITY facts (synchronous)
  │
  └─ void runAiAnalysis({ photos })  (fire-and-forget, non-blocking)
       │
       └─ analyzePhotos(photos) → GPT-4o Vision → AgentFact[]
            │
            └─ upsert AI_GUESS facts (never overwrites COMMUNITY / MESH_TRUTH)
```

### 2. On-demand analysis (operator triggered)

```
POST /api/properties/[id]/analyze  { photos?: [...], forceRefresh?: true }
  │
  ├─ if no photos in body, uses most recent AuditSubmission that has photos
  │
  ├─ analyzePhotos() → vision facts for fields with visible evidence
  │
  └─ gapFill() → text estimates for all remaining uncovered fields
       │
       └─ upsert AI_GUESS facts
```

### 3. Batch cron (nightly)

```
GET /api/cron/ai-scan?limit=20
  │
  ├─ find all properties with zero AI_GUESS facts
  │
  └─ for each property (up to limit):
       gapFill(name, location, existingFields) → upsert AI_GUESS facts
```

### Tier protection rules

| Existing tier | AI can overwrite? |
|--------------|-------------------|
| None (field missing) | Yes |
| `OFFICIAL` | Yes (AI_GUESS outranks OFFICIAL) |
| `AI_GUESS` | Yes, unless `skipExistingAiGuess=true` |
| `VERIFIED` | **Never** |
| `CONFIRMED` | **Never** |

---

## Authentication

Community audits are protected by a shared passphrase:

```
POST /api/auth/token  { "passphrase": "..." }
  → { "token": "<JWT>" }

POST /api/properties/[id]/accessibility
  Authorization: Bearer <JWT>
```

The JWT is signed with `JWT_SECRET` and has a 7-day expiry. The `COMMUNITY_PASSPHRASE` is the shared secret distributed to trusted field auditors.

**The cron endpoint** (`/api/cron/gossip`) is protected separately by `CRON_SECRET` passed as `Authorization: Bearer <CRON_SECRET>`. On Vercel this is automatically injected by the platform.

---

## API Surface

All routes are under `apps/node`:

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/.well-known/webfinger` | — | Node identity, public key, inbox URL (WebFinger discovery) |
| GET | `/api/nodeinfo` | — | Node identity and RSA public key |
| POST | `/api/inbox` | Signature | Receive real-time signed fact push from a peer node |
| GET | `/api/health` | — | Node identity, fact count, peer count |
| POST | `/api/auth/token` | — | Exchange passphrase for JWT |
| GET | `/api/properties?q=` | — | Search properties |
| GET | `/api/properties/[id]/accessibility` | — | Get collapsed facts with tier |
| POST | `/api/properties/[id]/accessibility` | Bearer JWT | Submit audit — saves VERIFIED facts, triggers peer push + background vision |
| GET | `/api/properties/[id]/external-ids` | — | Get OSM/Wheelmap IDs linked to this property |
| PATCH | `/api/properties/[id]/external-ids` | Bearer JWT | Set osmId/wheelmapId; optionally trigger immediate Wheelmap sync |
| POST | `/api/properties/[id]/external-ids` | Bearer JWT | Auto-discover Wheelmap node by bounding box |
| POST | `/api/properties/[id]/analyze` | Bearer JWT | On-demand AI analysis (vision + gap-fill) for one property |
| GET | `/api/gossip/snapshot?since=` | — | Export delta (facts + properties) for peer pull |
| POST | `/api/gossip/ingest` | — | Ingest delta from peer (two-phase: properties then facts) |
| GET | `/api/nodes` | — | List active peer nodes |
| POST | `/api/nodes` | — | Register a new peer |
| GET | `/api/cron/gossip` | Bearer CRON_SECRET | Trigger gossip pull cycle (also self-announces to peers) |
| GET | `/api/cron/ai-scan` | Bearer CRON_SECRET | Batch gap-fill for properties with no AI_GUESS coverage |
| GET | `/api/cron/wheelmap-sync` | Bearer CRON_SECRET | Sync OSM wheelchair ratings for all linked properties |

---

## CORS Policy

All `/api/*` routes set:

```
Access-Control-Allow-Origin: <CORS_ORIGINS env var, default *>
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
```

Set `CORS_ORIGINS` to a comma-separated list of allowed origins in production to lock down the API.

---

## Technology Choices

| Concern | Choice | Rationale |
|---------|--------|-----------|
| Framework | Next.js 14 App Router | API routes + SSR in one deployment unit |
| ORM | Prisma 5 | Type-safe, migration-first, works with Vercel Postgres |
| Auth | JWT (jsonwebtoken) | Stateless, no session store needed |
| Gossip transport | HTTP pull + push | Cron-based pull (safety net) + real-time signed push after each audit |
| Push signing | RSA-SHA256 (HTTP Signatures) | Stateless, no PKI authority needed; public keys served via WebFinger |
| AI provider | OpenAI GPT-4o | Best-in-class vision + JSON mode; swappable via ai-agent package |
| Photo storage | base64 in DB | No S3 dependency for MVP |
| Extension | Chrome MV3 vanilla JS | No build step; easy to load unpacked |
| SDK bundling | tsup (esbuild) | Fast, dual CJS+ESM with a single config |
| Monorepo | pnpm workspaces | Fast installs, strict isolation |
