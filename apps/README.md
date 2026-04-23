# Running the Apps

All flows assume you've completed setup (see root [README](../README.md)):

```bash
# Postgres
docker compose -f docker/docker-compose.dev.yml up postgres -d

# Migrate + seed
pnpm db:migrate
pnpm db:seed
```

`.env` must have `DATABASE_URL` and (optionally) `NODE_PRIVATE_KEY` / `NODE_PUBLIC_KEY` set (copy `.env.example` to get started).

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

**What it tests:** A field auditor submitting accessibility facts from the mobile app, including automatic routing to the correct regional node.

```bash
# Terminal 1 — node
pnpm dev

# Terminal 2 — field kit
pnpm dev:field-kit
# → http://localhost:3001
```

1. Open `http://localhost:3001` (or use Chrome DevTools device emulation).
2. You are redirected to `/login`. Enter your node credentials.
   - **No account yet?** Go to `/register` — enter a username/password to create a `USER` account, then ask the node admin to promote you to `AUDITOR` (Stats → Users panel on the node dashboard), then log in.
   - `USER` role is blocked at login with a pending-approval screen. Only `AUDITOR` or `ADMIN` can access the Field Kit.
3. After login, allow location access — the app silently calls `/api/peers/resolve` to find the node that covers your GPS position.
4. If a regional peer is found, a blue banner shows "Results from \<region\>" and searches are routed to that peer.
5. Search for a property (e.g. "Vienna"), tap a result.
6. If the property lives on a different node a "📤 Remote audit · \<hostname\>" indicator appears in the header.
7. Fill in accessibility fields and submit.
8. Open `http://localhost:3000` — the fact appears with tier `VERIFIED`.

**Verify:** Login issues a JWT signed by the home node's RS256 key. When auditing a remote node, the remote node fetches the home node's public key from `/.well-known/pubkey` and verifies the JWT — no shared secret needed. Wrong credentials return `401`. Submitted facts appear on the target node dashboard immediately.

---

---

## Flow 3 — Lens Extension on a Live Booking Site

**What it tests:** The Chrome extension overlaying data on a real booking site.

```bash
pnpm dev
```

1. Chrome → `chrome://extensions` → enable **Developer mode** → **Load unpacked** → select `apps/lens/`.
2. Click the Lens icon — a login form appears. Enter your node credentials and sign in.
   - First time? Click **Register on node →** to open `http://localhost:3000/register` in a new tab, create an account, get promoted to AUDITOR by the node admin, then return to the popup and sign in.
3. Navigate to a Booking.com or Expedia hotel page for a property in your node.

**Verify:** Overlay panel appears with field name, value, and tier badge. On listing pages, hover a hotel card — a tooltip shows accessibility facts after 350 ms. "Audited only" toggle on the node map highlights only properties with VERIFIED/CONFIRMED facts.

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

**What it tests:** Two nodes exchanging facts via gossip delta and automatic peer discovery.

```bash
# Terminal 1 — Node A (Netherlands)
pnpm dev

# Terminal 2 — Node B (London) — needs its own DATABASE_URL
PORT=3001 DATABASE_URL=<node-b-db> NODE_ID=node-b NODE_URL=http://localhost:3001 \
  OSM_BBOX="51.3,-.5,51.7,.3" \
  BOOTSTRAP_PEERS=http://localhost:3000 \
  pnpm --filter @wikitraveler/node dev
```

Node B bootstraps automatically: on startup it fetches `/api/nodeinfo` from Node A and upserts it as a peer.

1. Submit a fact to Node A via the Field Kit.
2. Node A pushes the signed fact to Node B's `/api/inbox`.
3. Every 6 hours (or trigger manually: `curl http://localhost:3001/api/cron/gossip`), Node B also pulls a full delta from Node A.
4. Open `http://localhost:3001` — the fact appears only if its property coordinates fall inside Node B's `OSM_BBOX`.

**Verify:** `GET http://localhost:3000/api/nodeinfo` shows Node B in the `peers[]` list after the first gossip cycle. Out-of-bbox properties are silently skipped. Tampered inbox signatures are rejected with `401`.

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
