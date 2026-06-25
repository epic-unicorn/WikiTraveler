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

## Flow 2 — WikiTraveler Access (travelers + auditors)

**What it tests:** Browsing verified accessibility on mobile, reporting missing/incorrect info, and (as `AUDITOR`) submitting on-site audits. Includes automatic routing to the correct regional peer node.

```bash
# Terminal 1 — node
pnpm dev

# Terminal 2 — WikiTraveler Access
pnpm dev:access
# → http://localhost:3001
```

1. Open `http://localhost:3001` (or use Chrome DevTools device emulation).
2. Register or sign in at `/login` — **`USER`**, `AUDITOR`, and `ADMIN` can all access the app.
3. Allow location access — the app calls `/api/peers/resolve` to find the node that covers your GPS position.
4. Search or use **Near me**, tap a property → **property detail** with tier badges.
5. As a traveler: **Save**, **Share**, or **Report issue** (community signal for auditors).
6. As an **AUDITOR**: on the map popup or property detail, tap **Start audit** to open the audit wizard and submit facts (`VERIFIED` tier).
7. Toggle **Map** / **List** on the search tab; use filters via the filter icon in the search bar.
8. **New property** (`+` in the toolbar): address is reverse-geocoded from GPS; coordinates are filled on submit.

**Verify:** User reports do not change displayed facts until an auditor submits a verified audit. New properties and audits appear on the map after cache invalidation (or within five minutes). Audit JWTs are signed by the home node; remote nodes verify via `/.well-known/pubkey`.

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

## Flow 4 — AI Scan

**What it tests:** Cron-triggered GPT-4o gap-filling for missing accessibility fields.

**Requires:** `OPENAI_API_KEY` in `.env`.

```bash
pnpm dev

curl http://localhost:3000/api/cron/ai-scan
```

**Verify:** Properties with gaps show new `AI_GUESS` facts. A subsequent field audit overrides them (tier upgrades to `VERIFIED`). Missing API key returns `503`.

---

---

## Flow 5 — Peer Gossip

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
3. Promote yourself to **AUDITOR** on Node A (Stats → Users) if using WikiTraveler Access for audits.

### 4. Propagate a fact

**Inbox push (fast path):**

1. Submit an audit on Node A (WikiTraveler Access with `NEXT_PUBLIC_NODE_API_URL=http://localhost:3000`, or the node UI).
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
| 2 — WikiTraveler Access | :3000 (node), :3001 (access) |
| 3 — Lens on Booking.com | :3000 (node) |
| 4 — AI Scan | :3000 (node) |
| 5 — Peer Gossip | :3000 (node A), :3010 (node B) |
