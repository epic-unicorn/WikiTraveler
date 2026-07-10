# Gossip lab (local peer testing)

**Docs:** [Hub](./README.md) · [Development](./DEVELOPMENT.md) · [Releases](./RELEASES.md) · [Architecture](./ARCHITECTURE.md)

Two-node setup for testing inbox push and gossip pull without production infrastructure.

---

## Docker (recommended)

```bash
pnpm dev:gossip-lab     # foreground — Node A :3000, Node B :3010
pnpm gossip:check       # verify peer registration + property/override counts
pnpm gossip:link-peers  # if bootstrap has not linked yet
pnpm gossip:sync        # manual gossip pull on both nodes
pnpm gossip:crud        # demo: property CRUD + metadata-override propagation
pnpm gossip:reingest    # re-run OSM ingest; confirm overrides survive
```

**Prerequisites:** Docker Desktop. First start runs `pnpm install` inside the container (empty `node_modules` volume) and may take several minutes.

if containers crash-loop after an image change, rebuild:

```bash
docker compose -f docker/docker-compose.gossip.yml down
docker compose -f docker/docker-compose.gossip.yml up --build
```

**First run:**

1. Complete `/setup` on both nodes ([http://localhost:3000](http://localhost:3000) and [http://localhost:3010](http://localhost:3010)).
2. On each node, open **Admin** (`/stats`) → **Region & data**.
3. Select preset **Eindhoven** (or draw the same bbox on both nodes) → **Save region**.

Use the **same bbox on both nodes** so gossip facts are not filtered out during ingest.

**Offline fixture:** `scripts/fixtures/osm-51.39_5.42_51.49_5.52.json`. After setting region:

```bash
pnpm node:region --preset eindhoven
pnpm gossip:seed
```

Or load the bundled sample via Admin → **Load sample data**, then `pnpm gossip:seed`.

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


| Symptom                                                     | Fix                                                                                                             |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `Could not parse schema engine response` / OpenSSL warnings | Rebuild: `docker compose -f docker/docker-compose.gossip.yml build --no-cache` then `up`                        |
| Crash-loop on first start                                   | Wait for `pnpm install` to finish inside the container (can take 5–10 min)                                      |
| `A knows B: NO` but linked in UI on B                       | One-way or inactive peer on A — run `pnpm gossip:link-peers` to reactivate                                      |
| Failed `gossip:sync` then empty peers on A                  | Earlier sync marked B inactive; `link-peers` fixes it (sync no longer deactivates peers)                        |
| Audit on A, nothing on B                                    | Same region bbox on both nodes; run `pnpm gossip:sync`                                                          |
| Audit on B, nothing on A                                    | Run `pnpm gossip:sync` — facts are remapped by `canonicalId` across nodes                                       |
| `node-b` sync from `node-b` in stats                        | Self peer record (often `http://node-b:3000`) — restart lab; bootstrap now deactivates self peers               |
| Map empty on node A (logged out)                            | Gossip lab allows unauthenticated map when `GOSSIP_DEV=true`; hard-refresh after ingest                         |
| Inbox push silent                                           | `NODE_PRIVATE_KEY` must be set on Node A                                                                        |
| `snapshot fetch failed: 401`                                | Peers missing cached public keys — run `gossip:link-peers`                                                      |
| Empty map / 0 properties on both nodes                      | Set region on both nodes (`pnpm node:region --preset eindhoven`) and run `pnpm gossip:seed` or load sample data |
| Empty map (no fixture file)                                 | `pnpm node:region --preset eindhoven`, `pnpm node:ingest overpass --preset eindhoven`, then `pnpm gossip:seed`  |


---



## Scripts


| Command                  | Description                                                                           |
| ------------------------ | ------------------------------------------------------------------------------------- |
| `pnpm dev:gossip-lab`    | Docker Compose: two nodes + two Postgres                                              |
| `pnpm gossip:seed`       | Seed OSM fixture into both lab DBs (bbox must be set in Admin)                        |
| `pnpm gossip:link-peers` | Mutual peer registration (localhost URLs)                                             |
| `pnpm gossip:sync`       | `GET /api/cron/gossip` on both nodes                                                  |
| `pnpm gossip:crud`       | Property CRUD + metadata-override propagation demo (create → override → sync → reset) |
| `pnpm gossip:reingest`   | Re-run OSM ingest from the fixture on both nodes; verifies manual overrides survive   |
| `pnpm gossip:check`      | Peer + property + override smoke check                                                |


---



## Property edits, OSM re-ingest, and override gossip

The lab exposes dev-only endpoints (no auth, gated on `GOSSIP_DEV=true`) so scripts can
exercise the full metadata-override lifecycle:


| Endpoint                                | Purpose                                                                                     |
| --------------------------------------- | ------------------------------------------------------------------------------------------- |
| `GET /api/dev/property[?canonicalId=]`  | List/inspect base vs effective metadata + provenance                                        |
| `POST /api/dev/property`                | Upsert a base property by `canonicalId`                                                     |
| `PATCH /api/dev/property`               | Write metadata overrides (`name`/`location`/`lat`/`lon` or `resetFields`) and push to peers |
| `DELETE /api/dev/property?canonicalId=` | Delete a property                                                                           |
| `POST /api/dev/reingest[?bbox=&live=1]` | Re-run OSM ingest from the committed fixture (base refresh)                                 |


**End-to-end walkthrough:**

```bash
pnpm gossip:crud       # creates lab:crud-demo on A, edits it (override), syncs to B,
                       # prints base vs effective on both, then resets one field
pnpm gossip:reingest   # re-ingests OSM base data on both nodes; overrides remain intact
pnpm gossip:check      # confirms property + override counts on both nodes
```

`gossip:crud` proves manual edits become overrides that win at read time and travel via
both real-time inbox push and `gossip:sync` pull. `gossip:reingest` proves an OSM refresh
updates only base metadata and never clobbers manual overrides.