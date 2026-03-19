# Apps — Testing Full Flows

This directory contains every runnable application in the WikiTraveler monorepo. Each section below describes a **self-contained test scenario** you can run locally without any external services (unless noted).

---

## Prerequisites

Complete the [first-time setup](../docs/DEVELOPMENT.md) (install deps, run migrations, seed the database) before running any of the flows below.

```bash
pnpm install
pnpm exec prisma migrate dev
pnpm db:seed
```

All flows assume the node is running on **http://localhost:3000** unless stated otherwise.

---

## Flow 1 — Agency SDK Widget

**What it tests:** A travel agency embedding the WikiTraveler widget via `<script>` tag with no framework.

**Apps involved:** `apps/agency-demo`, `apps/node`

### Steps

```bash
# Terminal 1 — Start the node
pnpm dev
# → http://localhost:3000

# Terminal 2 — Build the SDK (required for the UMD bundle)
pnpm --filter @wikitraveler/sdk build

# Terminal 3 — Serve the demo
npx serve apps/agency-demo
# → http://localhost:3001  (or whichever port `serve` picks)
```

1. Open the agency demo in your browser.
2. Set the **Node URL** field to `http://localhost:3000` and enter a property ID from your seed data (e.g. `demo-grand-hotel-vienna`).
3. Click **Load** — the WikiTraveler accessibility widget renders with facts pulled from the node.

**What to verify:**
- Widget renders with tier badges (Official / AI Estimate / Verified / Confirmed).
- Source badges show the data origin (Amadeus, Wheelmap ♿, Field Audit, etc).
- Empty-state message appears for an unknown property ID.

---

## Flow 2 — Field Auditor (Field Kit)

**What it tests:** A field auditor scanning a property, submitting facts, and the node upgrading fact tiers.

**Apps involved:** `apps/field-kit`, `apps/node`

### Steps

```bash
# Terminal 1 — Start the node
pnpm dev
# → http://localhost:3000

# Terminal 2 — Start the Field Kit
cd apps/field-kit
cp ../../.env.example .env.local
# Edit .env.local: NEXT_PUBLIC_NODE_API_URL=http://localhost:3000
pnpm dev -- -p 3001
# → http://localhost:3001
```

1. In the Field Kit, enter the **community passphrase** (set via `COMMUNITY_PASSPHRASE` in `.env`) to get an auditor token.
2. Select a property and submit an accessibility fact (e.g. `entrance_step_free = true`).
3. Open the node dashboard at **http://localhost:3000** and find the property — the fact should appear with tier `VERIFIED`.
4. Submit the same fact from a second auditor session (or a different browser/incognito window) — the tier should upgrade to `CONFIRMED`.

**What to verify:**
- JWT token is issued after correct passphrase.
- Submitted facts appear immediately in the node dashboard.
- Tier upgrades from `VERIFIED` → `CONFIRMED` after independent corroboration.
- Incorrect passphrase returns `401`.

---

## Flow 3 — Lens Extension on a Live Booking Site

**What it tests:** The Chrome extension detecting a property on a real third-party booking site and overlaying accessibility data.

**Apps involved:** `apps/lens`, `apps/node`

### Steps

```bash
# Terminal 1 — Start the node
pnpm dev
# → http://localhost:3000
```

1. Open Chrome → `chrome://extensions` → enable **Developer mode**.
2. Click **Load unpacked** → select `apps/lens/`.
3. Click the Lens toolbar icon → **Options** → set Node URL to `http://localhost:3000`.
4. Navigate to a Booking.com or Expedia hotel page for a property ID that exists in your node.

The WikiTraveler overlay panel slides in automatically if the property is recognised.

**What to verify:**
- Overlay appears with field name, value, tier badge, and source badge.
- "No accessibility data" message shown for unrecognised properties.
- Panel can be dismissed and re-opened via the toolbar icon.

---

## Flow 4 — Lens Extension on the Lens Demo (No SDK Integration)

**What it tests:** The Lens extension detecting a property on an agency site that has **no WikiTraveler SDK** — only a `<meta name="wt-property-id">` tag. This is the primary test scenario for the zero-friction integration path.

**Apps involved:** `apps/lens`, `apps/lens-demo`, `apps/node`

### Steps

```bash
# Terminal 1 — Start the node
pnpm dev
# → http://localhost:3000

# Terminal 2 — Serve the "StayWell" fake booking site
npx serve apps/lens-demo
# → http://localhost:3001 (or next available port)
```

1. Make sure the Lens extension is loaded (see Flow 3, steps 1–3).
2. In Lens Options, confirm Node URL is `http://localhost:3000`.
3. Open the StayWell demo: **http://localhost:3001**.
4. Click **View rooms →** on any hotel (e.g. "Grand Hotel Vienna").
5. The page navigates to `?hotel=demo-grand-hotel-vienna` and sets `<meta name="wt-property-id" content="demo-grand-hotel-vienna">`.
6. The Lens overlay appears with accessibility facts from the node.

**What to verify:**
- Overlay fires without any `<script>` tag, SDK import, or API call in the demo HTML.
- URL updates to `?hotel=<id>` and browser back button works correctly.
- Overlay shows tier badge + source badge per fact row.
- Pasting a direct hotel URL (e.g. `http://localhost:3001?hotel=demo-hotel-sacher-wien`) also triggers the overlay on load.

---

## Flow 5 — AI Scan (Automated Fact Extraction)

**What it tests:** The cron job trigger that calls GPT-4o to fill in missing accessibility fields.

**Apps involved:** `apps/node`

### Prerequisites

Set `OPENAI_API_KEY` in `.env`.

### Steps

```bash
# Node must be running
pnpm dev
# → http://localhost:3000

# Trigger the AI scan cron endpoint manually
curl -X POST http://localhost:3000/api/cron/ai-scan \
  -H "Authorization: Bearer <CRON_SECRET>"
```

1. Check the node dashboard — properties that had zero AI-tier facts should now show `AI_GUESS` facts.
2. Trigger again — already-scanned properties are skipped (idempotent).

**What to verify:**
- New `AI_GUESS` facts appear on the dashboard.
- A field auditor can later override an `AI_GUESS` fact by submitting from the Field Kit (tier upgrades to `VERIFIED`).
- Missing `OPENAI_API_KEY` returns `503` gracefully.

---

## Flow 6 — Peer Gossip & ActivityPub Push

**What it tests:** Two nodes exchanging accessibility facts via signed HTTP inbox pushes.

**Apps involved:** Two instances of `apps/node`

### Steps

```bash
# Terminal 1 — Node A (primary)
pnpm dev
# → http://localhost:3000

# Terminal 2 — Node B (second node)
cd apps/node
PORT=3001 DATABASE_URL=<node-b-db> NODE_ID=node-b NODE_URL=http://localhost:3001 \
  pnpm dev -- -p 3001
# → http://localhost:3001

# Register Node B as a peer of Node A
curl -X POST http://localhost:3000/api/nodes \
  -H "Content-Type: application/json" \
  -d '{"url":"http://localhost:3001"}'
```

1. Use the Field Kit to submit a `VERIFIED` fact to **Node A**.
2. Node A automatically pushes the signed fact batch to Node B's inbox (`POST /api/inbox`).
3. Open the Node B dashboard at **http://localhost:3001** — the fact should appear.

**What to verify:**
- WebFinger endpoint: `GET http://localhost:3000/.well-known/webfinger` returns `nodeId` + public key + inbox URL.
- Node B inbox rejects a replay with a tampered signature (`401`).
- Facts received via push appear with the correct tier and source on Node B's dashboard.

---

## Quick Reference

| Flow | Key scenario | Ports used |
|------|-------------|------------|
| 1 — Agency Widget | SDK `<script>` embed | :3000 (node), :3001 (demo) |
| 2 — Field Auditor | Submit + corroborate facts | :3000 (node), :3001 (field-kit) |
| 3 — Lens on Booking.com | Real booking site overlay | :3000 (node) |
| 4 — Lens on Lens Demo | Zero-SDK meta-tag overlay | :3000 (node), :3001 (lens-demo) |
| 5 — AI Scan | Cron-triggered GPT-4o fill | :3000 (node) |
| 6 — Peer Gossip | Two-node signed push | :3000 (node A), :3001 (node B) |

For environment variable reference and Docker deployment, see [docs/DEPLOYMENT.md](../docs/DEPLOYMENT.md).
For full architecture context, see [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md).
