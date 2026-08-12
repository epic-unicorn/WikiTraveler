# Vercel production

**Docs:** [Hub](./README.md) · [Operators](./OPERATORS.md) · [Upgrade](./UPGRADE.md) · [Docker](./DOCKER.md)

Deploy the **node** (API + dashboard) and optionally **WikiTraveler Access** as separate Vercel projects. The node needs hosted PostgreSQL. Access is a frontend client — the **canonical hub** is `https://access.wikitraveler.org`; regional/branded Access is optional ([RFC-0002](./rfcs/0002-global-hub-access.md)).

```
https://node.example.com              → Node (API + dashboard) — regional truth
https://access.wikitraveler.org       → Canonical hub Access (project / hub operators)
https://audit.example.com             → Optional branded Access (same app, different origin)
```

Lens and the agency SDK call **node** URLs directly (Lens via extension background fetch). Hub Access calls home + data nodes over HTTPS; every public data node must allow the hub origin(s) in `CLIENT_ORIGINS` / `CORS_ORIGINS`.

---

## When to use this

- Serverless hosting without managing a VPS
- Low-ops production with automatic cron jobs (gossip, AI scan, Wheelmap sync)
- Hub or branded Access as a separate mobile-friendly URL

**Not ideal for:** the **first** large OSM ingest (countries, Benelux). Do that on [local dev](./LOCAL.md) or [Docker](./DOCKER.md) first, then deploy.

---

## Prerequisites

1. **PostgreSQL** — [Neon](https://neon.tech), [Supabase](https://supabase.com), or [Vercel Postgres](https://vercel.com/storage/postgres). Use a pooler URL and SSL (`?sslmode=require`).
2. **RS256 keypair** — required for cross-node auth and JWT verification:

```bash
openssl genrsa -out node_private.pem 2048
openssl rsa -in node_private.pem -pubout -out node_public.pem
```

3. **Vercel** — Hobby plan works; OSM ingestion does not run on Vercel.

---

## Steps

### 1. Provision the database

Create a PostgreSQL database and apply migrations once from your machine:

```bash
DATABASE_URL="postgresql://..." pnpm db:deploy
```

### 2. Deploy the node

#### Create the Vercel project

1. Import the GitHub repo in the [Vercel dashboard](https://vercel.com/new).
2. Set **Root Directory** to the **repository root** (not `apps/node`).
3. **Framework Preset:** Next.js.
4. Build settings:

| Setting | Value |
|---------|-------|
| **Install Command** | `pnpm install` |
| **Build Command** | `pnpm run vercel-build` (builds `core` / `i18n` / `ui` / `ai-agent`, then Next in `apps/node`) |
| **Output Directory** | `apps/node/.next` |
| **Root Directory** | repository root (keeps root `vercel.json` crons) |

If Vercel only allows Root Directory on the app folder, use **Root Directory = `apps/node`**:

| Setting | Value |
|---------|-------|
| **Install Command** | `cd ../.. && pnpm install` |
| **Build Command** | `cd ../.. && pnpm run vercel-build` |

Do **not** use a bare `next build` / `@wikitraveler/node` build without building workspace packages first — `@wikitraveler/i18n` and friends resolve from `dist/`.

The repo-root `vercel.json` configures cron jobs when deployed from root. `apps/node`’s `build` script also runs `vercel-build:packages` so the legacy `@vercel/next` builder path stays safe.

#### Node environment variables

Set these in the **Vercel project → Settings → Environment Variables** (or `vercel env add`). Do **not** put secrets in `vercel.json` — the old `@secret-name` block is removed; crons stay in `vercel.json`, env lives in the project.

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | **Yes** | Neon/Postgres **pooled** URL with SSL (`?sslmode=require`) |
| `NODE_ID` | **Yes** | Stable unique ID, e.g. `wikitraveler-nl` |
| `NODE_URL` | **Yes** | Public URL, e.g. `https://wikitraveler-node.vercel.app` (update after first deploy if needed) |
| `NODE_PRIVATE_KEY` | **Recommended** | RSA private key PEM |
| `NODE_PUBLIC_KEY` | **Recommended** | RSA public key PEM |
| `CRON_SECRET` | **Yes** | Random string; all cron routes require `Authorization: Bearer <value>` |
| `CLIENT_ORIGINS` | Strongly recommended | Trusted hub Access + Lens + SDK origins — e.g. `https://access.wikitraveler.org` ([RFC-0002](./rfcs/0002-global-hub-access.md)) |
| `CORS_ORIGINS` | Strongly recommended | Extra browser origins (or same list). Do **not** use `*` on public nodes |
| `ACCESS_PUBLIC_URL` | No | Access URL advertised on `/api/nodeinfo` (directory only — not auto CORS from gossip) |
| `BOOTSTRAP_PEERS` | No | Comma-separated peer node URLs |
| `OPENAI_API_KEY` / `AI_*` | No | AI features — see [LOCAL.md § AI provider](./LOCAL.md#ai-provider-optional) |
| `WHEELMAP_API_KEY` | No | Wheelmap sync |

`NEXT_PUBLIC_NODE_API_URL` belongs on the **Access** Vercel project, not the node.

Paste PEM keys with literal `\n` for newlines, or use multi-line values in the Vercel dashboard.

#### Rate limiting (recommended for public nodes)

Uses [Upstash Redis](https://upstash.com) (free tier). Without these, rate limiting is silently skipped.

| Variable | Required | Description |
|----------|----------|-------------|
| `UPSTASH_REDIS_REST_URL` | No | Upstash REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | No | Upstash REST token |

| Route | Limit |
|-------|-------|
| `POST /api/auth/login` | 10 requests / 60 s per IP |
| `POST /api/auth/register` | 10 requests / 60 s per IP |
| `POST /api/properties/*/accessibility` | 20 requests / 60 s per IP |

#### AI scan budget

| Variable | Required | Description |
|----------|----------|-------------|
| `MAX_AI_SCAN_PER_RUN` | No | Max properties per daily AI scan run (default `20`, ceiling `50`) |

The `?limit=N` query param on `/api/cron/ai-scan` can override per call (still capped at 50).

#### Photo storage

Default (unset): base64 in Postgres. Set `PHOTO_STORAGE_PROVIDER` for object storage.

| Variable | When | Description |
|----------|------|-------------|
| `PHOTO_STORAGE_PROVIDER` | Optional | `r2` or `supabase` |
| `R2_ACCOUNT_ID` | provider=`r2` | Cloudflare account ID |
| `R2_ACCESS_KEY_ID` | provider=`r2` | R2 access key |
| `R2_SECRET_ACCESS_KEY` | provider=`r2` | R2 secret key |
| `R2_BUCKET` | provider=`r2` | Bucket name |
| `R2_PUBLIC_URL` | provider=`r2` | Public URL (e.g. `https://pub-xxx.r2.dev`) |
| `SUPABASE_URL` | provider=`supabase` | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | provider=`supabase` | Service role key |
| `SUPABASE_STORAGE_BUCKET` | provider=`supabase` | Bucket name (default `photos`) |

Cloudflare R2 free tier: 10 GB / 1 M writes per month. Supabase Storage free tier: 1 GB.

After switching from base64, migrate existing photos once from your machine:

```bash
PHOTO_STORAGE_PROVIDER=r2 R2_ACCOUNT_ID=... R2_BUCKET=... \
  R2_ACCESS_KEY_ID=... R2_SECRET_ACCESS_KEY=... R2_PUBLIC_URL=https://... \
  DATABASE_URL=postgresql://... \
  pnpm db:migrate-photos
```

The script is idempotent — rows that already contain HTTPS URLs are skipped.

#### Deploy and verify

```bash
vercel deploy --prod
```

```bash
curl https://node.example.com/api/health
curl https://node.example.com/api/setup
curl https://node.example.com/.well-known/pubkey
```

### 3. First-run admin setup

Open `https://node.example.com` → redirected to `/setup`, or:

```bash
curl -X POST https://node.example.com/api/setup \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"your-secure-password"}'
```

### 4. Load data (no server-side OSM ingest on Vercel)

Vercel **serves and imports** property data only — it does not run OSM ingestion. Use one of these paths:

**Option A — shared database (recommended for large regions)**

1. On local/Docker, point `DATABASE_URL` at your hosted Postgres.
2. Run `pnpm node:region --preset <id>` and ingest — e.g. `netherlands`, `japan`, `us-california`, or a city preset such as `tokyo` / `eindhoven` (Overpass for cities; PBF for Geofabrik ids). See [LOCAL.md](./LOCAL.md#region-presets-global-catalog).
3. Deploy to Vercel with the same `DATABASE_URL` — data is already in Postgres.

**Option B — gzip JSON export/import**

1. On local/Docker: `pnpm node:export --out wikitraveler-export.json.gz`
2. On Vercel: Admin → **Region & data** → **Import production data**

**Option C — sample data (zero setup)**

Admin → **Region & data** → **Load sample data** (Eindhoven bundle). Useful for demos; run `pnpm node:build-sample` once in dev to generate the file.

Configure region bbox in Admin → **Region & data** (save only). Property CRUD lives under the **Properties** tab.

### 5. Deploy WikiTraveler Access (hub or branded)

Access is a **separate** Vercel project — no database, no cron. **Hub operators** deploy the canonical (and optional backup) Access. **Node operators** usually skip this and point travelers at `https://access.wikitraveler.org`.

1. Import the same repo again (second project), e.g. `wikitraveler-access` or `wikitraveler-access-backup`.
2. **Root Directory:** `apps/access` (or repo root with output `apps/access/.next`).
3. Build:

| Setting | Value |
|---------|-------|
| **Install Command** | `cd ../.. && pnpm install` (if root is `apps/access`) |
| **Build Command** | `pnpm --filter @wikitraveler/access build` |
| **Output Directory** | `apps/access/.next` |

4. Environment variable — default **home** node for registration/login (GPS resolve still reaches peers):

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_NODE_API_URL` | **Yes** | Home node URL, e.g. `https://node.example.com` (no trailing slash) |

Baked in at build time — redeploy Access after changing the home node URL.

**H5:** Redeploy **Node + Access** together when map/API contracts change (e.g. `map?bbox=`). See [COMPATIBILITY.md](./COMPATIBILITY.md).

5. Allow this Access origin on **every public data node** travelers will hit (including yours):

```env
CLIENT_ORIGINS=https://access.wikitraveler.org,https://access-backup.example.org,https://audit.example.com
# or merge into CORS_ORIGINS — both feed the middleware allowlist
```

**H4:** Keep a second Access project as backup; list both origins on nodes before you need them.

6. Verify: open Access → `/login` → sign in → search/audit outside the home region when peers allow the hub origin → confirm on the **data** node dashboard.

### 6. Connect other clients

| Client | Configuration |
|--------|---------------|
| **Lens** | Load unpacked / Release zip from `apps/lens/` → options → **home** node URL; grant optional HTTPS host access on Save; prefer `chrome-extension://<id>` in `CLIENT_ORIGINS` on nodes ([LENS.md](./LENS.md)) |
| **Agency SDK** | Widget at node URL; add agency origin to `CLIENT_ORIGINS` / `CORS_ORIGINS` |

---

## Cron jobs

Defined in [`vercel.json`](../vercel.json):

| Path | Schedule | Purpose |
|------|----------|---------|
| `/api/cron/gossip` | Daily 01:00 UTC (Hobby-compatible; Pro may use a denser schedule) | Peer fact sync |
| `/api/cron/ai-scan` | Daily 02:00 UTC | AI gap-fill |
| `/api/cron/wheelmap-sync` | Daily 03:00 UTC | Wheelmap wheelchair data |

OSM refresh is **offline only** (`pnpm node:ingest` on local/Docker) — not scheduled on Vercel.

All cron routes verify `Authorization: Bearer <CRON_SECRET>`.

---

## Checklist

- [ ] PostgreSQL provisioned; `pnpm db:deploy` applied
- [ ] Vercel Pro plan (for OSM ingest)
- [ ] `NODE_URL` matches production domain
- [ ] RS256 keypair set
- [ ] `CRON_SECRET` set
- [ ] First data load: shared `DATABASE_URL` ingest, gzip import, or **Load sample data**
- [ ] `CORS_ORIGINS` locked down (not `*`)
- [ ] First admin created via `/setup`
- [ ] Region configured in Admin → Region & data
- [ ] At least one auditor promoted
- [ ] WikiTraveler Access deployed with `NEXT_PUBLIC_NODE_API_URL`
- [ ] `/api/health` returns 200
- [ ] Test audit from WikiTraveler Access appears on dashboard
