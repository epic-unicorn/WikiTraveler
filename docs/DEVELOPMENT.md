# Development Guide

Everything you need to run, build, and extend WikiTraveler locally.

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | v20+ | https://nodejs.org |
| pnpm | v9+ | `npm install -g pnpm` |
| PostgreSQL | 16 | https://www.postgresql.org or use Docker |
| Docker Desktop | any | https://www.docker.com (optional) |
| Chrome | any | for loading the Lens extension |

---

## First-Time Setup

```bash
# 1. Clone the repo
git clone https://github.com/your-org/wikitraveler.git
cd wikitraveler

# 2. Install all workspace dependencies
pnpm install

# 3. Copy and edit the environment file
cp .env.example .env
```

Open `.env` and fill in at minimum:

```env
DATABASE_URL=postgresql://wikitraveler:wikitraveler@localhost:5432/wikitraveler
JWT_SECRET=<long random string>
COMMUNITY_PASSPHRASE=<shared auditor password>
```

See [Environment Variables](#environment-variables) for a full reference.

---

## Database Setup

WikiTraveler uses **PostgreSQL 16** via Prisma. You need a running database before the node can start.

### Option A — local Postgres

```bash
# Create the database
createdb wikitraveler

# Run migrations (creates all tables)
pnpm exec prisma migrate dev --name init

# Seed with sample hotels
pnpm db:seed
```

### Option B — Docker Postgres only

```bash
docker run -d \
  --name wikitraveler-db \
  -e POSTGRES_USER=wikitraveler \
  -e POSTGRES_PASSWORD=wikitraveler \
  -e POSTGRES_DB=wikitraveler \
  -p 5432:5432 \
  postgres:16-alpine

pnpm exec prisma migrate dev --name init
pnpm db:seed
```

### Prisma commands

| Command | Description |
|---------|-------------|
| `pnpm db:generate` | Regenerate Prisma client after schema changes |
| `pnpm db:migrate` | Create and apply a new migration |
| `pnpm exec prisma studio` | Open Prisma Studio (visual DB browser) |
| `pnpm exec prisma migrate reset` | Drop and recreate the database (dev only) |

---

## Running the Stack Locally

### Node (primary app)

```bash
pnpm dev
# → http://localhost:3000
```

This starts `apps/node` in Next.js development mode with hot reload.

Verify it is running:

```bash
curl http://localhost:3000/api/health
```

Expected response:

```json
{
  "nodeId": "my-node-1",
  "version": "0.1.0",
  "url": "http://localhost:3000",
  "peerCount": 0,
  "factCount": 12,
  "startedAt": "2026-03-18T..."
}
```

### Field Kit (mobile audit app)

The Field Kit is a separate Next.js app. It connects to the node via an environment variable.

```bash
# In a second terminal
cd apps/field-kit
cp ../../.env.example .env.local
# Ensure NEXT_PUBLIC_NODE_API_URL=http://localhost:3000

pnpm dev -- -p 3001
# → http://localhost:3001
```

Open in a mobile browser or use Chrome DevTools device emulation.

### Lens (Chrome extension)

No build step required — just load it as an unpacked extension:

1. Open Chrome → `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select the `apps/lens/` folder

The extension icon appears in the toolbar. Click it, then go to **Options** and set the node URL to `http://localhost:3000`.

Visit a hotel page on Booking.com or Expedia — the overlay panel appears automatically if the property ID is recognised.

### Agency Demo

The agency demo is a static HTML file — no server needed.

1. First build the SDK so the UMD bundle exists:

```bash
pnpm --filter @wikitraveler/sdk build
```

2. Open the file directly in a browser:

```
apps/agency-demo/index.html
```

Or serve it with any static server:

```bash
npx serve apps/agency-demo
# → http://localhost:3000
```

In the demo page, set the **Node URL** field to your running node (`http://localhost:3000`).

---

## Building Packages

### All packages and apps (production)

```bash
pnpm build
```

This runs in order: `@wikitraveler/core` → `@wikitraveler/ai-agent` → `@wikitraveler/sdk` → `@wikitraveler/node` → `@wikitraveler/field-kit`.

> `ai-agent` must be built before `sdk` or `node` because both packages depend on it at build time via the `workspace:*` protocol.

### Individual packages

```bash
# Core shared logic
pnpm --filter @wikitraveler/core build

# AI agent (must be built before sdk and node)
pnpm --filter @wikitraveler/ai-agent build

# Agency SDK (CJS + ESM + UMD)
pnpm --filter @wikitraveler/sdk build

# Node (Next.js standalone output)
pnpm --filter @wikitraveler/node build

# Field Kit (Next.js standalone output)
pnpm --filter @wikitraveler/field-kit build
```

---

## Package Reference

### `packages/core`

**Purpose:** Shared types, constants, and pure merge logic. No runtime dependencies (no browser APIs, no Node APIs).

**Source:** `src/types.ts`, `src/merge.ts`, `src/index.ts`

**Build tool:** tsup (outputs CJS + ESM + `.d.ts`)

**Key exports:**

```typescript
import { Tier, SourceType, TIER_RANK, TIER_LABEL, TIER_COLOR, ACCESSIBILITY_FIELDS } from "@wikitraveler/core";
import { pickWinningFact, collapseFacts, evaluateConfirmed, mergeGossipDelta } from "@wikitraveler/core";
```

**Extending:** Add new accessibility fields to `ACCESSIBILITY_FIELDS` in `src/types.ts`. Add a new tier to the `Tier` enum and update all four `TIER_*` maps.

**Build output:**

```
packages/core/dist/
  index.js      CJS
  index.mjs     ESM
  index.d.ts    Type declarations
```

---

### `packages/sdk`

**Purpose:** Browser-facing client library for travel agencies to embed accessibility data.

**Source:** `src/client.ts`, `src/widget.ts`, `src/index.ts`

**Build tool:** tsup with `tsup.config.ts` (two build passes: CJS+ESM+DTS, then IIFE/UMD)

**Configuration:**

```typescript
// tsup.config.ts — two build passes
[
  { entry: ["src/index.ts"], format: ["cjs", "esm"], dts: true },
  { entry: { wikitraveler: "src/index.ts" }, format: ["iife"], globalName: "WikiTraveler",
    outExtension: () => ({ js: ".umd.js" }) }
]
```

**Build output:**

```
packages/sdk/dist/
  index.js              CJS (for bundlers)
  index.mjs             ESM (for Vite / Webpack 5)
  index.d.ts            Types
  wikitraveler.umd.js   UMD for <script> tags
```

**Usage after build:**

```html
<!-- CDN / script tag -->
<script src="/dist/wikitraveler.umd.js"></script>
<div data-wt-widget data-property-id="PROP123" data-node-url="https://your-node.vercel.app"></div>
```

```typescript
// ESM import
import { WikiTraveler, mountWidget } from "@wikitraveler/sdk";

const wt = new WikiTraveler({ nodeUrl: "https://your-node.vercel.app" });
const data = await wt.getAccessibility("PROP123");
```

---

### `packages/ai-agent`

**Purpose:** Encapsulates all OpenAI interactions for the node. By isolating the AI provider behind this package boundary, you can swap GPT-4o for any other model (Anthropic Claude, Gemini, etc.) by changing only this package — neither `apps/node` nor `packages/core` need to change.

**Source:** `src/types.ts`, `src/prompts.ts`, `src/vision.ts`, `src/gapfill.ts`, `src/index.ts`

**Build tool:** tsup (outputs CJS + ESM + `.d.ts`)

**Key exports:**

```typescript
import { analyzePhotos, gapFill } from "@wikitraveler/ai-agent";
import type { AgentFact, AnalyzeResult } from "@wikitraveler/ai-agent";
```

**Runtime requirement:** `OPENAI_API_KEY` must be set for either function to call the API. If the key is absent, the node routes that use these functions return `503` or silently skip the AI step.

**Build output:**

```
packages/ai-agent/dist/
  index.js      CJS
  index.mjs     ESM
  index.d.ts    Type declarations
```

---

### `apps/node`

**Purpose:** The core WikiTraveler node — REST API, gossip, and dashboard UI.

**Framework:** Next.js 14 App Router, `output: "standalone"` for Docker.

**Environment variables (set in `.env`):**

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `NODE_ID` | No | random | Stable identifier for this node |
| `NODE_URL` | No | `http://localhost:3000` | Public URL (used in gossip handshakes and signature `keyId`) |
| `JWT_SECRET` | Yes | — | Signs community JWTs |
| `COMMUNITY_PASSPHRASE` | Yes | — | Passphrase auditors use to get a token |
| `CORS_ORIGINS` | No | `*` | Comma-separated allowed origins |
| `BOOTSTRAP_PEERS` | No | — | Comma-separated peer URLs seeded into NodePeer on startup |
| `CRON_SECRET` | No | — | Protects `/api/cron/*` endpoints |
| `OPENAI_API_KEY` | No | — | GPT-4o key; leave blank to disable all AI features |
| `NODE_PRIVATE_KEY` | No | — | RSA private key PEM for signing outgoing inbox pushes |
| `NODE_PUBLIC_KEY` | No | — | Corresponding RSA public key PEM, served at `/api/nodeinfo` |
| `WHEELMAP_API_KEY` | No | — | Wheelmap API key for OSM wheelchair data sync |

**Dev commands:**

```bash
cd apps/node
pnpm dev          # hot-reload dev server on :3000
pnpm build        # Next.js production build
pnpm start        # start production build
```

**Folder structure:**

```
apps/node/
├── app/
│   ├── .well-known/
│   │   └── webfinger/          GET  — WebFinger discovery (identity + public key + inbox URL)
│   ├── api/
│   │   ├── auth/token/         POST — get JWT
│   │   ├── cron/
│   │   │   ├── gossip/         GET  — gossip pull cycle + self-announce (cron)
│   │   │   ├── ai-scan/        GET  — batch AI gap-fill (cron)
│   │   │   └── wheelmap-sync/  GET  — sync OSM wheelchair data (cron)
│   │   ├── gossip/
│   │   │   ├── snapshot/       GET  — export delta (facts + properties)
│   │   │   └── ingest/         POST — import delta (two-phase: properties then facts)
│   │   ├── health/             GET  — node status
│   │   ├── inbox/              POST — receive real-time signed fact push from peer
│   │   ├── nodeinfo/           GET  — node identity + RSA public key
│   │   ├── nodes/              GET/POST — peer registry
│   │   └── properties/
│   │       ├── route.ts        GET  — search
│   │       └── [id]/
│   │           ├── accessibility/  GET/POST — facts (POST triggers push + vision)
│   │           ├── analyze/        POST — on-demand AI analysis
│   │           └── external-ids/   GET/PATCH/POST — OSM/Wheelmap ID linking
│   ├── properties/[id]/        Property detail page + audit form
│   └── page.tsx                Dashboard
├── instrumentation.ts          Next.js startup hook — bootstraps peers from BOOTSTRAP_PEERS
├── lib/
│   ├── prisma.ts               Singleton PrismaClient
│   ├── auth.ts                 JWT helpers
│   ├── nodeInfo.ts             NODE_ID, NODE_URL constants
│   ├── aiAnalyze.ts            runAiAnalysis() shared helper
│   ├── bootstrap.ts            bootstrapPeers() + announceTopeer()
│   ├── httpSignature.ts        signBody(), verifyBody(), buildSignatureHeader(), fetchPeerPublicKey()
│   ├── push.ts                 pushFactsToPeers() — fire-and-forget signed peer push
│   └── wheelmap.ts             Wheelmap/OSM API adapter
└── next.config.js
```

---

### `apps/field-kit`

**Purpose:** Mobile-optimised audit app for field auditors.

**Framework:** Next.js 14 App Router (separate deployment from node).

**Environment variables (`.env.local` or `NEXT_PUBLIC_*`):**

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_NODE_API_URL` | Yes | URL of the target WikiTraveler node |

**Dev commands:**

```bash
cd apps/field-kit
pnpm dev          # starts on :3000 (or pass -p 3001 if node is already on :3000)
pnpm build
pnpm start
```

**Flow:**
1. `/` — search bar → enter a hotel name
2. `/audit/[id]` — loads property, presents 12 accessibility fields as toggles + free-text inputs
3. Submit button → `POST /api/properties/[id]/accessibility` on the node with a JWT
4. Success screen shows shareable link to the property page on the node

---

### `apps/lens`

**Purpose:** Chrome Manifest V3 extension.

**No build step.** All files are plain JavaScript.

**Files:**

| File | Description |
|------|-------------|
| `manifest.json` | Extension manifest (MV3, Booking/Expedia/Hotels permissions) |
| `background.js` | Service worker — responds to `GET_NODE_URL` messages from content scripts |
| `content.js` | Injected into matching pages — extracts property ID, overlays panel |
| `popup.html/js` | Toolbar popup showing current property's accessibility facts |
| `options.html/js` | Options page — node URL configuration, saved to `chrome.storage.sync` |

**Loading in Chrome (development):**

```
chrome://extensions → Developer mode ON → Load unpacked → select apps/lens/
```

**Extending to new sites:** Add the new hostname to `host_permissions` and `content_scripts.matches` in `manifest.json`. Add a new ID extraction branch to `extractPropertyId()` in `content.js`.

---

### `apps/agency-demo`

**Purpose:** Self-contained demo of the three SDK integration patterns.

**No framework, no build step.** A single `index.html` file.

**Before opening:** Build the SDK so the UMD bundle exists:

```bash
pnpm --filter @wikitraveler/sdk build
```

Then open `apps/agency-demo/index.html` in a browser. Use the **Node URL** field at the top to point it at a running node.

The three patterns demonstrated:

1. **Drop-in widget** — `<div data-wt-widget data-property-id="..." data-node-url="...">` with `autoMount()`.
2. **Raw JSON fetch** — `WikiTraveler.getAccessibility("PROP123")` with your own rendering.
3. **npm ESM import** — shows the equivalent `import` statement for bundler-based projects.

---

## TypeScript

All packages and apps share a base TypeScript config at `tsconfig.base.json`. Each package extends it with package-specific settings.

**Type-check everything:**

```bash
pnpm --filter @wikitraveler/core exec tsc --noEmit
pnpm --filter @wikitraveler/ai-agent exec tsc --noEmit
pnpm --filter @wikitraveler/sdk exec tsc --noEmit
pnpm --filter @wikitraveler/node exec tsc --noEmit
pnpm --filter @wikitraveler/field-kit exec tsc --noEmit
```

**Key tsconfig notes:**

- `packages/sdk` sets `lib: ["ES2020", "DOM"]` because it uses browser globals (`document`, `fetch`, `AbortController`).
- `packages/core` intentionally omits `DOM` — it must stay environment-agnostic.
- All apps use `moduleResolution: "bundler"` from the base config.

---

## Environment Variables

Full reference for all variables used across the monorepo:

| Variable | Used by | Required | Description |
|----------|---------|----------|-------------|
| `DATABASE_URL` | node | Yes | PostgreSQL URL (also used by Prisma CLI) |
| `NODE_ID` | node | No | Stable unique ID for this node instance |
| `NODE_URL` | node | No | Public-facing URL of this node |
| `JWT_SECRET` | node | Yes | HMAC-SHA256 key for signing JWTs |
| `COMMUNITY_PASSPHRASE` | node | Yes | Shared password for field auditors |
| `CORS_ORIGINS` | node | No | Allowed CORS origins (`*` or comma list) |
| `SEED_NODES` | node | No | Bootstrap peer URLs, comma-separated |
| `GOSSIP_INTERVAL_HOURS` | node | No | Hours between gossip cron runs |
| `CRON_SECRET` | node | No | Bearer token for cron endpoints |
| `OPENAI_API_KEY` | node | No | GPT-4o API key; enables AI_GUESS tier features |
| `NEXT_PUBLIC_NODE_API_URL` | field-kit | Yes | Node URL for the Field Kit to connect to |

---

## Seeding Data

```bash
pnpm db:seed
```

The seed script (`scripts/seed.ts`) seeds three sample properties identified by their Wikidata Q-identifier (`canonicalId`): **Grand Hotel Vienna** (Q610297), **Hotel Arts Barcelona** (Q5897396), and **Pulitzer Amsterdam** (Q17371014). Each is seeded with `OFFICIAL`-tier accessibility facts sourced from Wikidata.

Re-running the seed is safe — it uses `upsert` on `canonicalId`.
