# Docker production

**Docs:** [Hub](./README.md) · [Operators](./OPERATORS.md) · [Upgrade](./UPGRADE.md) · [Vercel](./VERCEL.md)

Self-host a WikiTraveler node with Docker Compose. Postgres and the node run in containers — no Vercel required.

**WikiTraveler Access** can run in the same stack for local/branded testing — see [Node + Access stack](#node--access-stack) below, or use local dev / [Vercel](./VERCEL.md#5-deploy-wikitraveler-access-hub-or-branded). Production travelers usually use the **canonical hub** (`access.wikitraveler.org`); co-locating Access is optional ([OPERATORS.md](./OPERATORS.md#audiences)).

---

## Node + Access stack

Run **Postgres, node, and WikiTraveler Access** together (no compose profile):

```bash
cp .env.example .env   # set keys, NODE_URL, CLIENT_ORIGINS / CORS_ORIGINS, etc.
pnpm docker:stack      # or: docker compose -f docker/docker-compose.node-access.yml up -d
```

| Service | URL |
|---------|-----|
| Node | http://localhost:3000 |
| WikiTraveler Access | http://localhost:3001 |
| Postgres (host tools) | `localhost:5432` (`POSTGRES_HOST_PORT` in `.env`) |

First-time setup: open http://localhost:3000/setup for the admin account, then use Access at http://localhost:3001.

Set `NEXT_PUBLIC_NODE_API_URL` in `.env` to the URL **browsers** use for the node (default `http://localhost:3000`). Rebuild Access after changing it:

```bash
pnpm docker:stack:build
# or rebuild access only:
docker compose -f docker/docker-compose.node-access.yml up --build -d access
```

Include the Access origin in `CORS_ORIGINS` / `CLIENT_ORIGINS` (the stack defaults to `http://localhost:3001,http://localhost:3000` when unset). For a public node, also allow the canonical hub (and backup) origins.

Stop / reset:

```bash
pnpm docker:stack:down        # keep database volume
pnpm docker:stack:reset       # wipe postgres volume
```

Compose file: [`docker/docker-compose.node-access.yml`](../docker/docker-compose.node-access.yml).

---

## When to use this

- You want full control over hosting (VPS, home server, on-prem)
- **Recommended host for the first large OSM ingest** (countries, Benelux) before pointing Vercel at the same database
- You need Geofabrik PBF imports (`osmium-tool` is included in the image)
- (Optional) Fully self-hosted WikiTraveler Access without a separate Vercel project

---

## Prerequisites

- Docker and Docker Compose
- A server with enough disk for Postgres + OSM data
- (Recommended) RS256 keypair for cross-node auth:

```bash
openssl genrsa -out node_private.pem 2048
openssl rsa -in node_private.pem -pubout -out node_public.pem
```

---

## Steps

### 1. Configure environment

Copy `.env.example` to `.env` in the **repository root** and fill in your values (keys, `NODE_URL`, `CORS_ORIGINS`, optional AI/Upstash/R2 vars). The compose files load this via `env_file` — **do not put secrets in `docker-compose.yml`**.

```bash
cp .env.example .env
```

Set at minimum for production:

```env
NODE_ID=my-production-node
NODE_URL=https://wikitraveler.example.com
NODE_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"
NODE_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"
CORS_ORIGINS=https://audit.example.com,https://myagency.com
```

When using the optional Docker WikiTraveler Access on the same host, include its origin (e.g. `http://localhost:3001` or your public audit URL).

`DATABASE_URL` in `.env` is what **host-side** tools use (`pnpm db:setup`, Prisma Studio). Keep it on `localhost:5432` when Postgres runs in Docker on the same machine.

Inside Docker containers, compose overrides `DATABASE_URL` to `postgres:5432` on the internal network.

Postgres is published on **127.0.0.1:5432** by default (`POSTGRES_HOST_PORT`) so `docker compose -f docker/docker-compose.yml up` does not leave the DB unreachable from the host. Change the port if 5432 is already in use.

Restart after changing `.env`:

```bash
docker compose -f docker/docker-compose.yml up -d
```

### Pull published images (after `v0.2.0`)

Pre-built images are published to GitHub Container Registry on each release tag:

```bash
# In .env
WIKITRAVELER_VERSION=0.4.0

docker compose -f docker/docker-compose.yml pull node
docker compose -f docker/docker-compose.yml up -d
```

| Image | Registry |
|-------|----------|
| Node | `ghcr.io/ingmarstruijs/wikitraveler-node:0.2.0` |
| Access | `ghcr.io/ingmarstruijs/wikitraveler-access:0.2.0` |

First-time GHCR pull may require making the package **public** in GitHub → **Packages** → package settings, or logging in with a PAT that has `read:packages`.

To build from source instead of pulling, use `docker compose ... up --build` (compose still has `build:` alongside `image:`).

### 2. Start the stack

```bash
docker compose -f docker/docker-compose.yml up --build -d
```

On first run this builds the image, starts Postgres, runs `prisma migrate deploy`, and starts the node on port 3000.

### 2b. (Optional) Start WikiTraveler Access in Docker

Prefer the [Node + Access stack](#node--access-stack) for both apps in one command. Alternatively, WikiTraveler Access uses the compose profile `access` on `docker-compose.yml` — it is **not** started by the node-only command above.

```bash
# Production WikiTraveler Access on :3001 (rebuild after changing NEXT_PUBLIC_NODE_API_URL)
docker compose -f docker/docker-compose.yml --profile access up --build -d

# Or shorthand
pnpm docker:access
```

Set `NEXT_PUBLIC_NODE_API_URL` in `.env` to the URL **browsers** use to reach your node (e.g. `http://localhost:3000` locally, or `https://wikitraveler.example.com` in production). This value is baked into the WikiTraveler Access image at build time.

Open http://localhost:3001 (or your `ACCESS_PORT`). Add the WikiTraveler Access origin to `CORS_ORIGINS` on the node.

For dev Docker with hot reload:

```bash
docker compose -f docker/docker-compose.dev.yml --profile access up -d
# or: pnpm docker:access:dev
```

### 3. Verify health

```bash
curl http://localhost:3000/api/health
curl http://localhost:3000/api/setup
```

### 4. Create the first admin

Open your node URL in a browser → `/setup`, or use the setup API:

```bash
curl -X POST https://wikitraveler.example.com/api/setup \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"your-secure-password"}'
```

### 5. Configure region & OSM ingest

1. Sign in as **ADMIN** → **Admin** (`/stats`).
2. **Region & OSM ingest** → pick preset or draw bbox → **Preview** → **Apply & ingest**.
3. **Do not stop the container** until the job shows **COMPLETED**.

### 6. Connect clients

| Client | Configuration |
|--------|---------------|
| **WikiTraveler Access** | Optional Docker profile `access` (see §2b), [Vercel](./VERCEL.md#5-deploy-wikitraveler-access), or `pnpm dev:access` with `NEXT_PUBLIC_NODE_API_URL` pointing at your node |
| **Lens** | Extension options → your node URL |
| **Agency SDK** | Widget points at your node URL; add agency origin to `CORS_ORIGINS` |

Promote at least one auditor via Admin → **Users**.

---

## OSM ingest (Docker / offline CLI)

Docker runs OSM ingest as a **one-shot CLI process** (not in Admin). Best for first-time country-scale ingests.

| Method | Supported | Notes |
|--------|-----------|-------|
| **Tiled Overpass** (`node:ingest overpass`) | Yes | Any region size; Benelux ~128 tiles |
| **Geofabrik PBF** (`node:ingest pbf` / `osm-import-pbf`) | Yes | Large countries/states worldwide (Netherlands, Japan, California, Brazil, …) |
| **GeoJSON file** (`node:ingest geojson`) | Yes | Pre-processed geojsonseq from osmium |
| **Bundled sample** (`pnpm db:seed`) | Yes | Eindhoven fixture / gzip sample |

### Set region

```bash
docker compose -f docker/docker-compose.yml exec node pnpm node:region --preset netherlands
```

Or from the host with `DATABASE_URL` pointing at the container Postgres.

### Tiled Overpass

```bash
docker compose -f docker/docker-compose.dev.yml exec node pnpm node:ingest overpass --preset benelux
```

Runs to completion in one process — no browser or Admin job polling.

### Geofabrik PBF (CLI)

```bash
docker compose -f docker/docker-compose.yml exec node osm-import-pbf --region netherlands
```

The production image bundles `osm-import-pbf` (esbuild of `scripts/node-ingest-pbf.ts`). Dev stack: `pnpm osm:import-pbf:docker -- --region netherlands`.

### GeoJSON (manual osmium)

Prepare a file on any machine with `osmium-tool`, then:

```bash
docker compose exec node sh -c "osm-import-pbf --geojson /path/to/export.geojsonseq --preset netherlands"
```

### Weekly refresh

Re-run `pnpm node:ingest` on local/Docker, then `pnpm node:export` + Admin import — or share `DATABASE_URL`. Vercel does not schedule OSM refresh.

---

## Operations

```bash
# View logs
docker compose -f docker/docker-compose.yml logs -f node

# Stop (keeps data)
docker compose -f docker/docker-compose.yml down

# Stop and remove volumes (wipes database)
docker compose -f docker/docker-compose.yml down -v

# Apply new migrations after pulling updates
docker compose -f docker/docker-compose.yml up --build -d
```

### Register peers (optional)

```bash
curl -X POST https://wikitraveler.example.com/api/nodes \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin-jwt>" \
  -d '{"url":"https://other-node.example.com"}'
```

Or set `BOOTSTRAP_PEERS` — the gossip cron auto-registers on first run.

---

## Production hardening (optional)

Add these to your repo-root `.env` (loaded automatically by compose):

### Rate limiting

Recommended for public nodes. Uses [Upstash Redis](https://upstash.com) (free tier). Without these vars, rate limiting is silently skipped.

```env
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=
# Or Vercel Marketplace: KV_REST_API_URL / KV_REST_API_TOKEN
```

| Route | Limit |
|-------|-------|
| `POST /api/auth/login` | 10 requests / 60 s per IP |
| `POST /api/auth/register` | 10 requests / 60 s per IP |
| `POST /api/properties/*/accessibility` | 20 requests / 60 s per IP |

### AI scan budget

Caps the daily AI scan cron (`/api/cron/ai-scan`). Requires `OPENAI_API_KEY` or `AI_*` vars.

```env
MAX_AI_SCAN_PER_RUN=20
```

The `?limit=N` query param can override per call (still capped at 50).

### Photo storage

Default (unset): base64 in Postgres — fine for small deployments. For production volume, use object storage:

```env
PHOTO_STORAGE_PROVIDER=r2
```

**Cloudflare R2** (free: 10 GB / 1 M writes per month):

```env
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=wikitraveler-photos
R2_PUBLIC_URL=https://pub-xxx.r2.dev
R2_JURISDICTION=eu
```

**Supabase Storage** (free: 1 GB on free plan):

```env
PHOTO_STORAGE_PROVIDER=supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=
SUPABASE_STORAGE_BUCKET=photos
```

After switching from base64, migrate existing photos once:

```bash
PHOTO_STORAGE_PROVIDER=r2 R2_ACCOUNT_ID=... R2_BUCKET=... \
  R2_ACCESS_KEY_ID=... R2_SECRET_ACCESS_KEY=... R2_PUBLIC_URL=https://... \
  DATABASE_URL=postgresql://... \
  pnpm --filter @wikitraveler/node db:migrate-photos
```

The script is idempotent — rows that already contain HTTPS URLs are skipped.

### WikiTraveler Access URL

`NEXT_PUBLIC_NODE_API_URL` in `.env` tells WikiTraveler Access which node API to call:

```env
NEXT_PUBLIC_NODE_API_URL=https://wikitraveler.example.com
```

- **Optional Docker WikiTraveler Access** — set before `docker compose --profile access up --build`; rebuild the image when this changes.
- **Local dev** (`pnpm dev:access`) — read at dev-server startup.
- **Vercel** — set in the WikiTraveler Access project env vars; see [VERCEL.md](./VERCEL.md#5-deploy-wikitraveler-access).

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `exec /entrypoint.dev.sh: no such file or directory` (Windows) | Almost always **CRLF** shebangs in the image. Rebuild without cache: `docker compose -f docker/docker-compose.dev.yml build --no-cache node` then `up -d`. Ensure `*.sh` stay LF (repo `.gitattributes`). |
| `pnpm db:setup` → can't reach database at `localhost:5432` after `docker compose -f docker/docker-compose.yml up` | Recreate Postgres so the host port is published: `docker compose -f docker/docker-compose.yml up -d postgres`. `docker ps` should show `127.0.0.1:5432->5432/tcp` on the postgres container. |
| Port 5432 already in use | Set `POSTGRES_HOST_PORT=5433` in `.env` and `DATABASE_URL=...@localhost:5433/...`, then `docker compose ... up -d postgres`. |
| Dev + prod compose both need Postgres | Only one stack can bind a host port at a time. Use the same compose file, or different `POSTGRES_HOST_PORT` values. |
| Migrations already applied inside Docker but host `db:setup` fails | Expected if Postgres wasn't reachable from the host — fix the port mapping above, then run `pnpm db:setup` or `pnpm db:migrate`. |
| **P3009** — failed migration (e.g. `20260616120000_...`) when the node container starts | Postgres volume still has **old** migration rows from before migrations were squashed to `20260423123302_init`. Reset: `pnpm docker:reset` (or `docker compose -f docker/docker-compose.yml --profile access down -v`), then `up --build -d`. Seed fields from the host: `pnpm db:setup` or `pnpm db:seed`. |
| Properties missing from map | Backfill coordinates: `pnpm geocode:missing` (from host with `DATABASE_URL` pointing at Postgres) |
| Audit wizard shows no fields | Run `pnpm exec tsx scripts/seed-fields.ts` — included in `pnpm db:setup` |

---

## Checklist

- [ ] `NODE_URL` matches the public domain exactly
- [ ] RS256 keypair set
- [ ] `CORS_ORIGINS` lists WikiTraveler Access and agency domains (not `*` in production)
- [ ] First admin created via `/setup`
- [ ] Region configured and OSM ingest completed
- [ ] At least one auditor promoted
- [ ] `/api/health` returns 200
- [ ] Test audit from WikiTraveler Access appears on dashboard
