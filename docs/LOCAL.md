# Local development

Run WikiTraveler on your machine for day-to-day coding. This is **not** a deployment — the node runs in development mode with hot reload.

---

## When to use this

- Building or debugging node, WikiTraveler Access, Lens, or SDK features
- First-time setup and admin onboarding
- **First OSM ingest** for large regions (countries, Benelux) — fastest and most reliable option before going to production

---

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | v20+ |
| pnpm | v9+ (`npm install -g pnpm`) |
| Docker Desktop | for the Postgres container |
| Chrome | for the Lens extension |

---

## Steps

### 1. Install dependencies

```bash
git clone https://github.com/your-org/wikitraveler.git
cd wikitraveler
pnpm install
cp .env.example .env
```

Minimum `.env` values:

```env
DATABASE_URL=postgresql://wikitraveler:wikitraveler@localhost:5432/wikitraveler
NODE_PRIVATE_KEY=   # optional locally; generate with openssl (see .env.example)
NODE_PUBLIC_KEY=
```

### 2. Start Postgres

Either compose file publishes Postgres on **127.0.0.1:5432** (override with `POSTGRES_HOST_PORT` in `.env`):

```bash
# Lightweight — Postgres only (typical for pnpm dev on the host)
docker compose -f docker/docker-compose.dev.yml up postgres -d

# Full production stack (node + Postgres) — host tools can still use pnpm db:setup
docker compose -f docker/docker-compose.yml up postgres -d
```

### 3. Prepare the database

```bash
pnpm db:setup
```

This resets the local database, runs migrations, and seeds field definitions. **OSM accommodation data is not loaded automatically** — you configure that in Admin (step 6).

After pulling schema changes on an existing database, use `pnpm db:migrate` instead.

### 4. Start the apps

| Terminal | Command | URL |
|----------|---------|-----|
| 1 | `pnpm dev` | http://localhost:3000 — node dashboard + API |
| 2 | `pnpm dev:access` | http://localhost:3001 — WikiTraveler Access (travelers + auditors) |
| 3 | `pnpm dev:agency-demo` | http://localhost:4000/apps/agency-demo/ — SDK demo |

See [apps/README.md](../apps/README.md) for step-by-step flow walkthroughs.

### 5. Create the first admin

Open http://localhost:3000. If no admin exists you are redirected to `/setup` to create one.

You can also check via API:

```bash
curl http://localhost:3000/api/setup
curl -X POST http://localhost:3000/api/setup \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"your-password"}'
```

Promote auditors via **Admin** (`/stats`) → **Users**.

### 6. Configure region & OSM ingest

1. Sign in as **ADMIN** and open **Admin** (`/stats`).
2. In **Region & OSM ingest**, pick a catalog preset or draw a bbox on the map.
3. Click **Preview changes**, then **Apply & ingest**.
4. Watch tile progress in the same panel.

The map stays empty until this step completes.

---

## OSM ingest (offline CLI)

OSM ingestion runs **offline only** — not in Admin and not on Vercel. Use the `node:*` CLI against your local `DATABASE_URL`, then export or share the database with production.

| Method | When to use |
|--------|-------------|
| **Tiled Overpass** (`pnpm node:ingest overpass`) | Cities and medium regions (any size; Benelux ~128 tiles) |
| **Geofabrik PBF** (`pnpm node:ingest pbf`) | Large countries (Netherlands, France, Germany, …) |
| **GeoJSON file** (`pnpm node:ingest geojson`) | You prepared an extract offline with osmium |
| **Bundled sample** (`pnpm db:seed` or Admin → Load sample data) | Zero-setup Eindhoven demo data |

### 1. Set region

```bash
pnpm node:region --preset eindhoven
pnpm node:region --preset netherlands
pnpm node:region --bbox "50.75,3.36,53.55,7.23" --label "Netherlands"
```

This writes bbox/label to `NodeSettings` (same as Admin → **Save region**).

### 2. Ingest OSM data

**Tiled Overpass** (default for cities; also works for Benelux-scale):

```bash
pnpm node:ingest overpass --preset eindhoven
pnpm node:ingest overpass --preset benelux
```

**Geofabrik PBF** (large countries):

```bash
pnpm node:ingest pbf --region netherlands
pnpm node:ingest pbf --region france
```

Requires `osmium-tool`. On Windows use Docker: `pnpm osm:import-pbf:docker -- --region netherlands`.

**GeoJSON / geojsonseq** (offline osmium export):

```bash
pnpm node:ingest geojson --file ./export.geojsonseq --preset netherlands
```

### 3. Move data to Vercel

- **Shared DB:** point local `DATABASE_URL` at hosted Postgres, ingest, deploy Vercel with the same URL.
- **Gzip JSON:** `pnpm node:export --out export.json.gz` → Admin → **Import production data**.
- **Sample:** Admin → **Load sample data** (or `pnpm db:seed` with bundled `eindhoven.json.gz`).

Build the sample bundle once in dev: `pnpm node:build-sample`.

### Offline fixture (legacy)

```bash
pnpm node:region --preset eindhoven
pnpm db:seed
```

Uses `scripts/fixtures/osm-51.39_5.42_51.49_5.52.json` when no bundled sample exists.

Optional custom fixture:

```env
OSM_FIXTURE_PATH=/abs/path/to/scripts/fixtures/netherlands-osm.json
```

---

## Connect clients

### Lens extension

1. Chrome → `chrome://extensions` → enable **Developer mode**
2. **Load unpacked** → select `apps/lens/`
3. Extension options → set Node URL to `http://localhost:3000`, sign in
4. Register at http://localhost:3000/register if needed; promote to `AUDITOR` in Admin

### WikiTraveler Access

Runs on http://localhost:3001. Set node URL on the login screen (defaults to `NEXT_PUBLIC_NODE_API_URL` from `.env`). In local dev, Access proxies API calls to the node via `/node-api/` so cookies and CORS stay on one origin.

**Audit wizard fields:** `pnpm db:setup` seeds `FieldDefinition` rows via `scripts/seed-fields.ts`. If the audit wizard shows no fields after a manual migration, run `pnpm exec tsx scripts/seed-fields.ts`.

**Map coordinates:** new properties are forward-geocoded on create. For existing rows without lat/lon:

```bash
pnpm geocode:missing
pnpm geocode:missing --name "Hotel Name"
```

Map pin data is cached client-side for five minutes; creating a property or submitting an audit invalidates the cache automatically.

### Two-node gossip testing

See [GOSSIP-DEV.md](./GOSSIP-DEV.md) and `pnpm dev:gossip-lab`.

---

## Building packages

```bash
pnpm build                                          # all packages
pnpm --filter @wikitraveler/core build              # individual
pnpm --filter @wikitraveler/node build
```

Build order: `core` → `ai-agent` → `sdk` → `node` / `access`.

---

## Database commands

| Command | Description |
|---------|-------------|
| `pnpm db:setup` | Reset DB, migrate, seed field definitions |
| `pnpm db:migrate` | Apply pending migrations (keep data) |
| `pnpm db:seed` | Load bundled sample or legacy OSM fixture |
| `pnpm exec prisma studio` | Visual DB browser |

---

## AI provider (optional)

Configure in `.env` — see `.env.example` for OpenAI, Ollama, and LM Studio examples:

```env
AI_API_KEY=your_key
AI_BASE_URL=http://localhost:11434/v1
AI_VISION_MODEL=llama3.2-vision
AI_TEXT_MODEL=qwen2.5:7b
```

---

## Rate limiting (optional)

Protects auth and audit routes with sliding-window limits via [Upstash Redis](https://upstash.com) (free tier is enough for most nodes). Without these vars, rate limiting is **silently skipped** — fine for local dev.

```env
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=
```

| Route | Limit |
|-------|-------|
| `POST /api/auth/login` | 10 requests / 60 s per IP |
| `POST /api/auth/register` | 10 requests / 60 s per IP |
| `POST /api/properties/*/accessibility` | 20 requests / 60 s per IP |

---

## AI scan budget (optional)

Caps how many properties the daily AI scan cron (`/api/cron/ai-scan`) processes per run. Only relevant when `OPENAI_API_KEY` or `AI_*` vars are set.

```env
MAX_AI_SCAN_PER_RUN=20   # default 20, hard ceiling 50
```

The `?limit=N` query param can override per call (still capped at 50).

---

## Photo storage (optional)

By default, audit photos are stored as **base64 in Postgres** — zero config, good for local dev.

For production-like testing, switch to object storage:

```env
PHOTO_STORAGE_PROVIDER=       # unset = base64, or "r2" or "supabase"
```

### Cloudflare R2

Free tier: 10 GB / 1 M writes per month.

```env
PHOTO_STORAGE_PROVIDER=r2
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=wikitraveler-photos
R2_PUBLIC_URL=https://pub-xxx.r2.dev    # public bucket URL or custom domain
```

### Supabase Storage

Free tier: 1 GB on the Supabase free plan.

```env
PHOTO_STORAGE_PROVIDER=supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=
SUPABASE_STORAGE_BUCKET=photos          # default: "photos"
```

### Migrating existing photos

After switching from base64 to R2 or Supabase, upload existing photos once:

```bash
PHOTO_STORAGE_PROVIDER=r2 R2_ACCOUNT_ID=... R2_BUCKET=... \
  R2_ACCESS_KEY_ID=... R2_SECRET_ACCESS_KEY=... R2_PUBLIC_URL=https://... \
  DATABASE_URL=postgresql://... \
  pnpm db:migrate-photos
```

The script is idempotent — rows that already contain HTTPS URLs are skipped.

---

## WikiTraveler Access URL

When running WikiTraveler Access separately (`pnpm dev:access`), point it at your local node:

```env
NEXT_PUBLIC_NODE_API_URL=http://localhost:3000
```

Baked in at build time for production WikiTraveler Access deployments — see [VERCEL.md](./VERCEL.md#5-deploy-wikitraveler-access).

---

## Admin (`/stats`)

Tabbed management after sign-in:

| Tab | Purpose |
|-----|---------|
| **Region & data** | Set bbox, load sample, import/export gzip JSON |
| **Properties** | Create, edit, delete properties (with map picker) |
| **Users** | Account management |
| **Peers** | Federated node connections |
| **Backup & restore** | Full-node snapshot |

Legacy tools:

| Tool | Use when |
|------|----------|
| **Export / import audited** | Region move — preserve WikiTraveler Access / Lens audits (merge by OSM ID) |
| **Export / import users** | Move accounts (no passwords) |

Full backup **replaces the entire database** on restore — do not use it for a region move.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `Cannot find module 'next/dist/pages/_app'` | Corrupted `node_modules` — delete `node_modules` and run `pnpm install` |
| Map is empty after start | Complete `/setup`, then **Load sample data** in Admin or run `pnpm node:region --preset eindhoven && pnpm db:seed` |
| WikiTraveler Access CORS errors | Set `CORS_ORIGINS=*` in `.env` (fine for local dev) |
| Properties missing from map | `pnpm geocode:missing` |
| Audit wizard shows no fields | `pnpm exec tsx scripts/seed-fields.ts` |
| Port 5432 in use | Set `POSTGRES_HOST_PORT=5433` in `.env`, update `DATABASE_URL`, recreate the postgres container |
| `pnpm db:setup` can't connect after `docker-compose.yml up` | Postgres must show `127.0.0.1:5432->5432/tcp` in `docker ps` — run `docker compose -f docker/docker-compose.yml up -d postgres` to apply port mapping |
