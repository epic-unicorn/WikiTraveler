# Gossip lab (local peer testing)

Two-node setup for testing inbox push and gossip pull without production infrastructure.

---

## Docker (recommended)

```bash
pnpm dev:gossip-lab     # foreground — Node A :3000, Node B :3010
pnpm gossip:seed        # load Eindhoven OSM fixture into both DBs (if empty)
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

**First run:** Complete `/setup` on both nodes. Use the same `OSM_BBOX` (Eindhoven `51.39,5.42,51.49,5.52` in the compose file) so facts are not filtered out during ingest.

**Data:** The Eindhoven OSM fixture is committed at `scripts/fixtures/osm-51.39_5.42_51.49_5.52.json`. Docker startup seeds automatically when `GOSSIP_LAB_SEED=true`. If both nodes show zero properties, run `pnpm gossip:seed` (Postgres on ports 5433/5434 must be up). To refresh the fixture: `OSM_BBOX=51.39,5.42,51.49,5.52 pnpm osm:ingest --fixture-only`.

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
set OSM_BBOX=51.39,5.42,51.49,5.52
set BOOTSTRAP_PEERS=http://localhost:3000
set GOSSIP_DEV=true
set NODE_PRIVATE_KEY=<contents of node-b.private.pem>
set NODE_PUBLIC_KEY=<contents of node-b.public.pem>
pnpm exec prisma migrate deploy
pnpm exec tsx scripts/seed.ts
pnpm --filter @wikitraveler/node exec next dev -p 3010
```

Then:

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
| Audit on A, nothing on B | Same `OSM_BBOX` on both nodes; run `pnpm gossip:sync` |
| Audit on B, nothing on A | Run `pnpm gossip:sync` — facts are remapped by `canonicalId` across nodes |
| `node-b` sync from `node-b` in stats | Self peer record (often `http://node-b:3000`) — restart lab; bootstrap now deactivates self peers |
| Map empty on node A (logged out) | Gossip lab allows unauthenticated map when `GOSSIP_DEV=true`; hard-refresh after seed |
| Inbox push silent | `NODE_PRIVATE_KEY` must be set on Node A |
| `snapshot fetch failed: 401` | Peers missing cached public keys — run `gossip:link-peers` |
| Empty map / 0 properties on both nodes | Run `pnpm gossip:seed` — fixture is in `scripts/fixtures/`; lab auto-seeds on fresh start |
| Empty map (no fixture file) | `OSM_BBOX=51.39,5.42,51.49,5.52 pnpm osm:ingest --fixture-only` then `pnpm gossip:seed` |

---

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev:gossip-lab` | Docker Compose: two nodes + two Postgres |
| `pnpm gossip:seed` | Seed Eindhoven OSM fixture into both lab databases |
| `pnpm gossip:link-peers` | Mutual peer registration (localhost URLs) |
| `pnpm gossip:sync` | `GET /api/cron/gossip` on both nodes |
| `pnpm gossip:check` | Peer + property smoke check |
