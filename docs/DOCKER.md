# Docker production

Self-host a WikiTraveler node with Docker Compose. Postgres and the node run in containers — no Vercel required.

**WikiTraveler Access** is optional: enable the `access` compose profile to run it in Docker, or use local dev / [Vercel](./VERCEL.md#5-deploy-wikitraveler-access) instead.

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

### 2. Start the stack

```bash
docker compose -f docker/docker-compose.yml up --build -d
```

On first run this builds the image, starts Postgres, runs `prisma migrate deploy`, and starts the node on port 3000.

### 2b. (Optional) Start WikiTraveler Access in Docker

WikiTraveler Access uses the compose profile `access` — it is **not** started by the command above.

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

## OSM ingest (Docker)

Docker runs ingest in **continuous mode** (all tiles in one background process). This is the best option for first-time country-scale ingests.

| Method | Supported | Notes |
|--------|-----------|-------|
| **Tiled Overpass** (Admin) | Yes | ~1.5–2 hours for Benelux (~128 tiles); keep container running |
| **Geofabrik PBF** (CLI) | Yes | Netherlands, France, Germany, and other large countries |
| **GeoJSON upload** (Admin) | Yes | Upload a pre-processed file |
| **Fixture seed** | Yes | `docker compose exec node sh -c "pnpm db:seed"` after bbox configured |

### Tiled Overpass (default)

Same Admin flow as local dev. Ingest continues even if you close the browser — only stopping/restarting the container interrupts it.

### Geofabrik PBF (CLI)

Region bbox in Admin **must match** the Geofabrik region. For Netherlands:

1. Admin → **Netherlands** preset → **Preview changes**
2. Click **Save region only** (not “Apply & ingest”)
3. Run:

```bash
docker compose -f docker/docker-compose.yml exec node osm-import-pbf --region netherlands
```

The production image has no `pnpm` — use the `osm-import-pbf` command above (bundled at image build time). For the dev stack, `pnpm osm:import-pbf:docker` still works.

### GeoJSON upload (manual osmium)

Prepare a file on any machine with `osmium-tool`, then upload via Admin → **Import OSM GeoJSON**.

Geofabrik has **no single Benelux extract** — use tiled Overpass in Admin for Benelux, or download individual countries. Example below uses Netherlands.

**1. Download extract:**

```bash
curl -L -o netherlands-latest.osm.pbf \
  https://download.geofabrik.de/europe/netherlands-latest.osm.pbf
```

**2. Filter to accommodations:**

```bash
osmium tags-filter netherlands-latest.osm.pbf \
  nwr/tourism=hotel nwr/tourism=hostel nwr/tourism=motel \
  nwr/tourism=apartment nwr/tourism=guest_house nwr/tourism=chalet \
  nwr/tourism=resort nwr/tourism=alpine_hut nwr/tourism=vacation_rental \
  nwr/tourism=bed_and_breakfast nwr/amenity=hotel \
  -o netherlands-accommodation.osm.pbf -f pbf --overwrite
```

**3. Export:**

```bash
osmium export netherlands-accommodation.osm.pbf \
  -o netherlands-accommodation.geojsonseq -f geojsonseq --overwrite \
  -a id,type -u type_id
```

**4. Upload** in Admin (clips to configured bbox).

Or import inside the container:

```bash
docker compose exec node sh -c "osm-import-pbf --geojson /path/to/export.geojsonseq"
```

### Weekly refresh

Re-ingest manually in Admin, or set up an external cron that calls your node's ingest endpoint. Unlike Vercel, there is no built-in serverless cron — you manage scheduling yourself.

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
| `pnpm db:setup` → can't reach database at `localhost:5432` after `docker compose -f docker/docker-compose.yml up` | Recreate Postgres so the host port is published: `docker compose -f docker/docker-compose.yml up -d postgres`. `docker ps` should show `127.0.0.1:5432->5432/tcp` on the postgres container. |
| Port 5432 already in use | Set `POSTGRES_HOST_PORT=5433` in `.env` and `DATABASE_URL=...@localhost:5433/...`, then `docker compose ... up -d postgres`. |
| Dev + prod compose both need Postgres | Only one stack can bind a host port at a time. Use the same compose file, or different `POSTGRES_HOST_PORT` values. |
| Migrations already applied inside Docker but host `db:setup` fails | Expected if Postgres wasn't reachable from the host — fix the port mapping above, then run `pnpm db:setup` or `pnpm db:migrate`. |
| **P3009** — failed migration (e.g. `20260616120000_...`) when the node container starts | Postgres volume still has **old** migration rows from before migrations were squashed to `20260423123302_init`. Reset: `pnpm docker:reset` (or `docker compose -f docker/docker-compose.yml --profile access down -v`), then `up --build -d`. Seed fields from the host: `pnpm db:setup` or `pnpm db:seed`. |
| Properties missing from map | Backfill coordinates: `pnpm exec tsx scripts/geocode-missing-coords.ts` (from host with `DATABASE_URL` pointing at Postgres) |
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
