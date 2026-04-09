# Running the Apps

All flows assume you've completed setup (see root [README](../README.md)):

```bash
# Postgres
docker compose -f docker/docker-compose.dev.yml up postgres -d

# Migrate + seed
pnpm db:migrate
pnpm db:seed
```

`.env` must have `DATABASE_URL`, `JWT_SECRET`, and `COMMUNITY_PASSPHRASE` set (copy `.env.example` to get started).

---

## Flow 1 — Agency SDK Widget

**What it tests:** A travel agency embedding the WikiTraveler widget via `<script>` tag.

```bash
# Terminal 1 — node
pnpm dev

# Terminal 2 — agency demo (builds SDK, then serves from repo root)
pnpm dev:agency-demo
# → http://localhost:4000/apps/agency-demo/
```

1. Open `http://localhost:4000/apps/agency-demo/`.
2. The demo auto-connects to `http://localhost:3000` and populates the property dropdown.
3. Select a property — the widget renders with tier badges and live data.

**Verify:** Widget shows facts with `Official` / `AI Guess` / `Verified` / `Confirmed` badges. Changing the dropdown updates the widget and raw JSON output.

---

---

## Flow 2 — Field Auditor

**What it tests:** A field auditor submitting accessibility facts from the mobile app.

```bash
# Terminal 1 — node
pnpm dev

# Terminal 2 — field kit
pnpm dev:field-kit
# → http://localhost:3001
```

1. Open `http://localhost:3001` (or use Chrome DevTools device emulation).
2. Search for a property (e.g. "Vienna").
3. Tap a result — you'll be prompted for the community passphrase (`COMMUNITY_PASSPHRASE` from `.env`).
4. Fill in accessibility fields and submit.
5. Open `http://localhost:3000` — the fact appears with tier `VERIFIED`.

**Verify:** Correct passphrase issues a JWT; wrong passphrase returns `401`. Submitted facts appear on the node dashboard immediately. You can also create a new property from the search screen if it doesn't exist yet.

---

---

## Flow 3 — Lens Extension on a Live Booking Site

**What it tests:** The Chrome extension overlaying data on a real booking site.

```bash
pnpm dev
```

1. Chrome → `chrome://extensions` → enable **Developer mode** → **Load unpacked** → select `apps/lens/`.
2. Click the Lens icon → **Options** → set Node URL to `http://localhost:3000`.
3. Navigate to a Booking.com or Expedia hotel page for a property in your node.

**Verify:** Overlay panel appears with field name, value, and tier badge. Unknown properties show "No accessibility data".

---

---

## Flow 4 — Lens Extension on the Lens Demo

**What it tests:** Lens detecting a property via a `<meta name="wt-property-id">` tag — no SDK required.

```bash
# Terminal 1 — node
pnpm dev

# Terminal 2 — lens demo
npx serve apps/lens-demo -p 4001
# → http://localhost:4001
```

1. Load the Lens extension (Flow 3, steps 1–2).
2. Open `http://localhost:4001` and click through to a hotel page.
3. The Lens overlay fires automatically from the meta tag.

**Verify:** Overlay appears without any `<script>` tag on the page.

---

---

## Flow 5 — AI Scan

**What it tests:** Cron-triggered GPT-4o gap-filling for missing accessibility fields.

**Requires:** `OPENAI_API_KEY` in `.env`.

```bash
pnpm dev

curl http://localhost:3000/api/cron/ai-scan
```

**Verify:** Properties with gaps show new `AI_GUESS` facts. A subsequent field audit overrides them (tier upgrades to `VERIFIED`). Missing API key returns `503`.

---

---

## Flow 6 — Peer Gossip

**What it tests:** Two nodes exchanging facts via signed inbox pushes.

```bash
# Terminal 1 — Node A
pnpm dev

# Terminal 2 — Node B (needs its own DATABASE_URL)
PORT=3001 DATABASE_URL=<node-b-db> NODE_ID=node-b NODE_URL=http://localhost:3001 \
  pnpm --filter @wikitraveler/node dev

# Register Node B as a peer of Node A
curl -X POST http://localhost:3000/api/nodes \
  -H "Content-Type: application/json" \
  -d '{"url":"http://localhost:3001"}'
```

1. Submit a fact to Node A via the Field Kit.
2. Node A pushes the signed fact to Node B's inbox.
3. Open `http://localhost:3001` — the fact appears.

**Verify:** `GET http://localhost:3000/.well-known/webfinger` returns node identity + public key. Tampered signatures are rejected with `401`.

---

## Flow 7 — Registry

**What it tests:** Node auto-registration and peer discovery via the central registry.

```bash
# Terminal 1 — registry
pnpm dev:registry
# → http://localhost:3002

# Terminal 2 — node (with REGISTRY_URL=http://localhost:3002 in .env)
pnpm dev
```

With `REGISTRY_URL` set, the node calls `POST /api/v1/nodes/register` automatically on startup.

**Verify:** Open `http://localhost:3002` — your node appears in the "Registered Nodes" list.

```bash
# List registered nodes
curl http://localhost:3002/api/v1/nodes

# Peer recommendations
curl http://localhost:3002/api/v1/nodes/my-node-1/peers
```

---

## Quick Reference

| Flow | Ports |
|------|-------|
| 1 — Agency Widget | :3000 (node), :4000 (demo) |
| 2 — Field Auditor | :3000 (node), :3001 (field-kit) |
| 3 — Lens on Booking.com | :3000 (node) |
| 4 — Lens on Lens Demo | :3000 (node), :4001 (lens-demo) |
| 5 — AI Scan | :3000 (node) |
| 6 — Peer Gossip | :3000 (node A), :3001 (node B) |
| 7 — Registry | :3000 (node), :3002 (registry) |
