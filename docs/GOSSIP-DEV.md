# Gossip lab (local peer testing)

Two-node setup for testing inbox push and gossip pull without production infrastructure.

---

## Docker (recommended)

```bash
pnpm dev:gossip-lab     # foreground — Node A :3000, Node B :3010
pnpm gossip:check       # verify peer registration + property counts
pnpm gossip:link-peers  # if bootstrap has not linked yet
pnpm gossip:sync        # manual gossip pull on both nodes
```

**Prerequisites:** Docker Desktop. First start runs `pnpm install` inside the container (empty `node_modules` volume) and may take several minutes.

If containers crash-loop after an image change, rebuild:

```bash
docker compose -f docker/docker-compose.gossip.yml down
docker compose -f docker/docker-compose.gossip.yml up --build
```

**First run:**

1. Complete `/setup` on both nodes (http://localhost:3000 and http://localhost:3010).
2. On each node, open **Admin** (`/stats`) → **Region & OSM ingest**.
3. Select preset **Eindhoven (lab)** (or draw the same bbox on both nodes).
4. **Preview** → **Apply & ingest** on both nodes.

Use the **same bbox on both nodes** so gossip facts are not filtered out during ingest.

**Offline fixture:** `scripts/fixtures/osm-51.39_5.42_51.49_5.52.json`. After configuring region in Admin, `pnpm gossip:seed` can load it into both lab databases without calling Overpass. Refresh the fixture with `pnpm osm:ingest --fixture-only` (reads bbox from DB).

**Keys:** Dev RSA keypairs live in `docker/gossip-lab/*.pem` and are mounted at startup. Inbox push requires keys — the lab provides them automatically.

---

## Two terminals (no Docker)

Use one Postgres instance with two databases:

```sql
CREATE DATABASE wikitraveler_b;
```

**Terminal 1 — Node A**

```bash
pnpm dev
```

**Terminal 2 — Node B**

```bash
# Generate keys once: see docker/gossip-lab/README.md
set DATABASE_URL=postgresql://wikitraveler:wikitraveler@localhost:5432/wikitraveler_b
set NODE_ID=node-b
set NODE_URL=http://localhost:3010
set BOOTSTRAP_PEERS=http://localhost:3000
set GOSSIP_DEV=true
set NODE_PRIVATE_KEY=<contents of node-b.private.pem>
set NODE_PUBLIC_KEY=<contents of node-b.public.pem>
pnpm exec prisma migrate deploy
pnpm --filter @wikitraveler/node exec next dev -p 3010
```

Configure region in Admin on both nodes, then:

```bash
pnpm gossip:link-peers
pnpm gossip:check
```

---

## Troubleshooting

| Symptom | Fix |
|--------|-----|
| `Could not parse schema engine response` / OpenSSL warnings | Rebuild: `docker compose -f docker/docker-compose.gossip.yml build --no-cache` then `up` |
| Crash-loop on first start | Wait for `pnpm install` to finish inside the container (can take 5–10 min) |
| `A knows B: NO` but linked in UI on B | One-way or inactive peer on A — run `pnpm gossip:link-peers` to reactivate |
| Failed `gossip:sync` then empty peers on A | Earlier sync marked B inactive; `link-peers` fixes it (sync no longer deactivates peers) |
| Audit on A, nothing on B | Same region bbox on both nodes; run `pnpm gossip:sync` |
| Audit on B, nothing on A | Run `pnpm gossip:sync` — facts are remapped by `canonicalId` across nodes |
| `node-b` sync from `node-b` in stats | Self peer record (often `http://node-b:3000`) — restart lab; bootstrap now deactivates self peers |
| Map empty on node A (logged out) | Gossip lab allows unauthenticated map when `GOSSIP_DEV=true`; hard-refresh after ingest |
| Inbox push silent | `NODE_PRIVATE_KEY` must be set on Node A |
| `snapshot fetch failed: 401` | Peers missing cached public keys — run `gossip:link-peers` |
| Empty map / 0 properties on both nodes | Configure region in Admin on both nodes and run ingest |
| Empty map (no fixture file) | Configure region, then `pnpm osm:ingest --fixture-only` and `pnpm gossip:seed` |

---

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev:gossip-lab` | Docker Compose: two nodes + two Postgres |
| `pnpm gossip:seed` | Seed OSM fixture into both lab DBs (bbox must be set in Admin) |
| `pnpm gossip:link-peers` | Mutual peer registration (localhost URLs) |
| `pnpm gossip:sync` | `GET /api/cron/gossip` on both nodes |
| `pnpm gossip:check` | Peer + property smoke check |
