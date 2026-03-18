# Architecture

WikiTraveler is a federated, horizontally-scalable truth layer for travel data. This document explains how the pieces fit together.

---

## System Overview

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          Browser / Mobile                                │
│                                                                          │
│   ┌─────────────┐   ┌──────────────────┐   ┌──────────────────────────┐ │
│   │  Lens       │   │  Field Kit       │   │  Agency Website          │ │
│   │  (Chrome    │   │  (Mobile PWA)    │   │  + WikiTraveler SDK      │ │
│   │   MV3)      │   │                  │   │  (UMD / ESM / CJS)       │ │
│   └──────┬──────┘   └────────┬─────────┘   └─────────────┬────────────┘ │
│          │                   │                            │              │
└──────────┼───────────────────┼────────────────────────────┼──────────────┘
           │  REST             │  REST                      │  REST
           ▼                   ▼                            ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                        WikiTraveler Node                                 │
│                     (Next.js 14 App Router)                              │
│                                                                          │
│  ┌──────────────┐  ┌────────────────┐  ┌──────────────────────────────┐ │
│  │  /api/       │  │  /api/gossip/  │  │  /api/cron/gossip            │ │
│  │  properties  │  │  snapshot      │  │  (Vercel Cron / Docker loop) │ │
│  │  /audit      │  │  ingest        │  │                              │ │
│  │  /auth       │  └───────┬────────┘  └──────────────────────────────┘ │
│  └──────────────┘          │ Gossip pull                                 │
│                            │                                             │
│  ┌──────────────────────────────────────────────┐                        │
│  │  Prisma ORM                                  │                        │
│  │  Property | AccessibilityFact | NodePeer     │                        │
│  │  AuditSubmission | GossipSnapshot            │                        │
│  └──────────────────────┬───────────────────────┘                        │
│                         │                                                │
└─────────────────────────┼────────────────────────────────────────────────┘
                          │
                ┌─────────▼─────────┐
                │   PostgreSQL 16   │
                └───────────────────┘

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
| `Tier` enum | `OFFICIAL \| AI_GUESS \| COMMUNITY \| MESH_TRUTH` |
| `TIER_RANK` | Numeric rank map for comparison |
| `TIER_LABEL` | Human-readable label map |
| `TIER_COLOR` | CSS hex colour map |
| `ACCESSIBILITY_FIELDS` | Array of 12 field names |
| `pickWinningFact()` | Returns the higher-tier fact between two |
| `collapseFacts()` | Collapses an array of facts to one winner per field |
| `evaluateMeshTruth()` | Promotes facts to `MESH_TRUTH` when ≥ 3 distinct nodes agree |
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

---

## Data Model

```
Property
  id          cuid  PK
  amadeusId   string UNIQUE
  name        string
  location    string

AccessibilityFact
  id            cuid PK
  propertyId    FK → Property
  fieldName     string
  value         string
  tier          Tier enum
  sourceNodeId  string          ← which node originated this fact
  submittedBy   string?
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
  id       cuid PK
  url      string UNIQUE
  lastSeen DateTime
  isActive boolean

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
MESH_TRUTH (3) > COMMUNITY (2) > AI_GUESS (1) > OFFICIAL (0)
```

### MESH_TRUTH Promotion

`evaluateMeshTruth()` in `packages/core` inspects all facts for a given `(propertyId, fieldName, value)` triplet. If **≥ 3 distinct `sourceNodeId` values** carry the same value, that fact is promoted to `MESH_TRUTH`. This threshold is configurable (`meshThresholdNodes`, default 3).

---

## Gossip Protocol

WikiTraveler uses a **pull-based HTTP gossip** model. No WebSockets or message brokers are required.

### Flow

```
Node A (cron fires)
  │
  ├─ GET /api/nodes          (list active peers)
  │
  └─ for each peer B:
       GET B/api/gossip/snapshot?since=<lastSeen ISO timestamp>
         returns: { facts: AccessibilityFact[], fromNodeId, generatedAt }
       │
       POST /api/gossip/ingest  (local, applies delta)
         ├─ runs mergeGossipDelta (core)
         ├─ upserts winning facts
         ├─ re-evaluates MESH_TRUTH
         └─ records GossipSnapshot with SHA-256 hash
```

### Delta Snapshot format

`GET /api/gossip/snapshot?since=<ISO>` returns only facts created or updated **after** the `since` timestamp, limiting bandwidth to genuine changes.

### Cron schedule

- **Vercel** — configured in `vercel.json`, runs every 6 hours by default (`0 */6 * * *`).
- **Docker** — the two-node gossip demo uses a lightweight `gossip-scheduler` container that runs `curl` in a loop every 10 seconds (demo mode).

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
| GET | `/api/health` | — | Node identity, fact count, peer count |
| POST | `/api/auth/token` | — | Exchange passphrase for JWT |
| GET | `/api/properties?q=` | — | Search properties |
| GET | `/api/properties/[id]/accessibility` | — | Get collapsed facts with tier |
| POST | `/api/properties/[id]/accessibility` | Bearer JWT | Submit community audit |
| GET | `/api/gossip/snapshot?since=` | — | Export delta for peer pull |
| POST | `/api/gossip/ingest` | — | Ingest delta from peer |
| GET | `/api/nodes` | — | List active peer nodes |
| POST | `/api/nodes` | — | Register a new peer |
| GET | `/api/cron/gossip` | Bearer CRON_SECRET | Trigger gossip pull cycle |

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
| Gossip transport | HTTP pull | Simpler than WebSockets; works across Vercel/Docker |
| Photo storage | base64 in DB | No S3 dependency for MVP |
| Extension | Chrome MV3 vanilla JS | No build step; easy to load unpacked |
| SDK bundling | tsup (esbuild) | Fast, dual CJS+ESM with a single config |
| Monorepo | pnpm workspaces | Fast installs, strict isolation |
