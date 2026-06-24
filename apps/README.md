# Running the Apps

All flows assume you've completed setup (see root [README](../README.md)):

```bash
docker compose -f docker/docker-compose.dev.yml up postgres -d
pnpm db:setup
```

`.env` must have `DATABASE_URL` and (optionally) `NODE_PRIVATE_KEY` / `NODE_PUBLIC_KEY` set (copy `.env.example` to get started).

**Region ingest:** configure bbox and OSM data in Admin (`/stats` → **Region & OSM ingest**). Large regions (e.g. Benelux, ~128 tiles) need 1–2 hours — keep `pnpm dev` running. See [docs/LOCAL.md](../docs/LOCAL.md#osm-ingest-local).

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
2. Enter your node URL (default `http://localhost:3000`) and log in.
3. Search for a hotel by name or city, then click a result — details appear below and the SDK widget updates on the right.

**Verify:** Search results show fact counts; selecting a hotel updates the detail panel, live widget, and raw JSON output. Integration snippet tabs reflect the selected property ID.

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

**What it tests:** The Chrome extension on a real booking site (popup + listing tooltips).

```bash
pnpm dev
```

1. Chrome → `chrome://extensions` → enable **Developer mode** → **Load unpacked** → select `apps/lens/`.
2. Right-click the Lens icon → **Options** — set your node URL and sign in (or use the popup login).
   - First time? Click **Create account** to register on the node, get promoted to AUDITOR by the node admin, then sign in.
3. Navigate to a Booking.com or Expedia hotel page for a property in your node.

**Verify:** Click the Lens icon — the popup shows field values and tier badges. On listing pages, hover a hotel card to see a tooltip after 350 ms. The node map at `http://localhost:3000` shows all properties; use the search filters to narrow by tier.

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
3. Click the Lens icon — the popup reads the property ID from the `<meta name="wt-property-id">` tag.

**Verify:** Popup shows field values and tier badges without any `<script>` tag on the page.

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

**What it tests:** Two nodes exchanging facts via inbox push and gossip pull.

Use the **gossip lab** (Docker) — two nodes, two databases, dev keys, same region configured in Admin on both.

### 1. Start the lab

```bash
pnpm dev:gossip-lab
# → Node A http://localhost:3000
# → Node B http://localhost:3010
```

Wait until both nodes log `Starting WikiTraveler node` (~30–60s on first build).

### 2. Link peers

```bash
pnpm gossip:link-peers
pnpm gossip:check
```

Bootstrap may link peers automatically after both nodes finish starting; if `gossip:check` shows no peers, run `gossip:link-peers` (required once per fresh lab).

### 3. First-run setup

1. Open `http://localhost:3000/setup` and create an admin on **Node A**.
2. Open `http://localhost:3010/setup` and create an admin on **Node B**.
3. Promote yourself to **AUDITOR** on Node A (Stats → Users) if using Field Kit.

### 4. Propagate a fact

**Inbox push (fast path):**

1. Submit an audit on Node A (Field Kit with `NEXT_PUBLIC_NODE_API_URL=http://localhost:3000`, or the node UI).
2. Pick a property inside the shared bbox (Eindhoven region if you have the OSM fixture).
3. Open Node B’s map — the fact should appear within seconds.

**Gossip pull (fallback):**

```bash
pnpm gossip:sync
```

### 5. Verify

```bash
pnpm gossip:check
```

**Verify:** Each node lists the other in `peers[]`. Facts on A appear on B for in-bbox properties.

Manual two-terminal setup: [docs/GOSSIP-DEV.md](../docs/GOSSIP-DEV.md).

---

## Quick Reference

| Flow | Ports |
|------|-------|
| 1 — Agency Widget | :3000 (node), :4000 (demo) |
| 2 — Field Auditor | :3000 (node), :3001 (field-kit) |
| 3 — Lens on Booking.com | :3000 (node) |
| 4 — Lens on Lens Demo | :3000 (node), :4001 (lens-demo) |
| 5 — AI Scan | :3000 (node) |
| 6 — Peer Gossip | :3000 (node A), :3010 (node B) |
