# Deployment Guide

WikiTraveler ships two deployable Next.js apps: the **node** (API + dashboard) and the **field-kit** (mobile audit UI). Both run on Vercel. The node requires an external PostgreSQL database; the field-kit is a static frontend that calls the node over HTTPS.

---

## Overview

| App | Path | Vercel project | Database | Purpose |
| --- | --- | --- | --- | --- |
| **Node** | `apps/node` | 1 project | PostgreSQL (required) | API, dashboard, gossip, cron jobs |
| **Field Kit** | `apps/field-kit` | 1 project (separate) | None | Mobile audit UI for auditors |

Recommended production layout:

```
https://node.example.com      ? Node (API + dashboard)
https://audit.example.com     ? Field Kit (points at node via env var)
```

The Chrome **Lens** extension and agency SDK both call the node URL directly. Configure Lens in its settings page; set `NEXT_PUBLIC_NODE_API_URL` on Field Kit.

---

## Prerequisites

Before deploying either app:

1. **PostgreSQL** ? [Neon](https://neon.tech), [Supabase](https://supabase.com), [Vercel Postgres](https://vercel.com/storage/postgres), or self-hosted. Enable SSL (`?sslmode=require` on the connection string).
2. **RS256 keypair** ? required for cross-node auth and Field Kit / Lens JWT verification:

   ```bash
   openssl genrsa -out node_private.pem 2048
   openssl rsa -in node_private.pem -pubout -out node_public.pem
   ```

   Paste PEM contents into Vercel env vars. Use literal `\n` for newlines, or paste multi-line values in the Vercel dashboard.

3. **pnpm monorepo** ? both apps depend on workspace packages (`@wikitraveler/core`, `@wikitraveler/ai-agent`). Vercel must install from the **repository root**, not from the app subdirectory alone.

---

## Step 1 ? Provision the database

1. Create a PostgreSQL database with your provider.
2. Copy the connection string (pooler URL if available ? recommended for serverless).
3. Apply migrations **once** from your machine or CI:

   ```bash
   DATABASE_URL="postgresql://..." pnpm db:deploy
   ```

4. Optionally seed sample properties (dev/demo only):

   ```bash
   DATABASE_URL="postgresql://..." pnpm db:seed
   ```

---

## Step 2 ? Deploy the node on Vercel

### 2a. Create the Vercel project

1. Import the GitHub repo in the [Vercel dashboard](https://vercel.com/new).
2. Set **Root Directory** to the **repository root** (not `apps/node`).
3. Set **Framework Preset** to Next.js.
4. Override build settings:

   | Setting | Value |
   | --- | --- |
   | **Install Command** | `pnpm install` |
   | **Build Command** | `pnpm exec prisma generate && pnpm --filter @wikitraveler/core build && pnpm --filter @wikitraveler/ai-agent build && pnpm --filter @wikitraveler/node build` |
   | **Output Directory** | `apps/node/.next` |
   | **Root Directory (app)** | `apps/node` |

   If your Vercel UI only allows Root Directory on the app folder, use **Root Directory = `apps/node`** and set:

   | Setting | Value |
   | --- | --- |
   | **Install Command** | `cd ../.. && pnpm install` |
   | **Build Command** | `cd ../.. && pnpm exec prisma generate && pnpm --filter @wikitraveler/core build && pnpm --filter @wikitraveler/ai-agent build && pnpm --filter @wikitraveler/node build` |

   The repo-root `vercel.json` configures cron jobs and env placeholders for the node project when deployed from root.

### 2b. Environment variables (node)

Set these in the Vercel project **Settings ? Environment Variables**:

| Variable | Required | Description |
| --- | --- | --- |
| `DATABASE_URL` | **Yes** | PostgreSQL URL with SSL |
| `NODE_ID` | **Yes** | Stable unique ID, e.g. `wikitraveler-nl` |
| `NODE_URL` | **Yes** | Public URL, e.g. `https://node.example.com` |
| `NODE_REGION` | No | Display label, e.g. `Netherlands` |
| `NODE_PRIVATE_KEY` | **Recommended** | RSA private key PEM |
| `NODE_PUBLIC_KEY` | **Recommended** | RSA public key PEM |
| `CRON_SECRET` | **Yes (Vercel)** | Random string; cron routes require `Authorization: Bearer <value>` |
| `OPEN_REGISTRATION` | No | `"true"` (default) or `"false"` |
| `CORS_ORIGINS` | **Yes** | Comma-separated origins allowed to call the API. Include your Field Kit URL, agency domains, and `chrome-extension://<lens-id>` if needed. Use `*` only for demos. |
| `BOOTSTRAP_PEERS` | No | Comma-separated peer node URLs for gossip |
| `GOSSIP_INTERVAL_HOURS` | No | Default `24` |
| `OSM_BBOX` | No | Overpass bounding box: `lat_min,lon_min,lat_max,lon_max` |
| `OPENAI_API_KEY` | No | Enables AI scan (or use `AI_*` vars below) |
| `AI_API_KEY` | No | OpenAI-compatible provider key |
| `AI_BASE_URL` | No | e.g. `http://localhost:11434/v1` for Ollama |
| `AI_VISION_MODEL` | No | Vision model name |
| `AI_TEXT_MODEL` | No | Text model name |
| `WHEELMAP_API_KEY` | No | Wheelmap sync |

### 2c. Cron jobs

Cron schedules are defined in the repo-root [`vercel.json`](../vercel.json):

| Path | Schedule | Purpose |
| --- | --- | --- |
| `/api/cron/gossip` | Every 6 hours | Peer fact sync |
| `/api/cron/ai-scan` | Daily 02:00 UTC | AI gap-fill |
| `/api/cron/wheelmap-sync` | Daily 03:00 UTC | Wheelmap wheelchair data |
| `/api/cron/osm-ingest` | Weekly Mon 04:00 UTC | OSM property ingest |

Vercel sends cron requests automatically. Protect them with `CRON_SECRET` (the routes verify the bearer token).

### 2d. Deploy and verify

```bash
# CLI alternative (from repo root, after vercel link)
vercel deploy --prod
```

**Verify:**

```bash
curl https://node.example.com/api/health
curl https://node.example.com/api/setup    # { "setupRequired": true } on first run
curl https://node.example.com/.well-known/pubkey
```

### 2e. First-run admin setup

On first deploy, no admin account exists. Either:

1. Open `https://node.example.com` in a browser ? you are redirected to `/setup` to create the first administrator, or
2. Call the setup API:

   ```bash
   curl -X POST https://node.example.com/api/setup \
     -H "Content-Type: application/json" \
     -d '{"username":"admin","password":"your-secure-password"}'
   ```

Then promote auditors via **Stats ? Users** on the dashboard.

### 2f. Register peers (optional)

```bash
curl -X POST https://node-a.example.com/api/nodes \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin-jwt>" \
  -d '{"url":"https://node-b.example.com"}'
```

Or set matching `BOOTSTRAP_PEERS` on each node ? the gossip cron auto-registers on first run.

---

## Step 3 ? Deploy Field Kit on Vercel

Field Kit is a separate Vercel project with no database and no cron jobs.

### 3a. Create the Vercel project

1. Import the same GitHub repo again (second project).
2. Name it e.g. `wikitraveler-field-kit`.
3. Set **Root Directory** to `apps/field-kit` (or repo root with output `apps/field-kit/.next`).
4. Build settings:

   | Setting | Value |
   | --- | --- |
   | **Install Command** | `cd ../.. && pnpm install` (if root is `apps/field-kit`) or `pnpm install` (if root is repo root) |
   | **Build Command** | `pnpm --filter @wikitraveler/field-kit build` |
   | **Output Directory** | `apps/field-kit/.next` |

### 3b. Environment variables (field-kit)

| Variable | Required | Description |
| --- | --- | --- |
| `NEXT_PUBLIC_NODE_API_URL` | **Yes** | Full URL of your deployed node, e.g. `https://node.example.com` (no trailing slash) |

This is baked in at build time. Redeploy Field Kit after changing the node URL.

### 3c. CORS on the node

Add your Field Kit origin to the node's `CORS_ORIGINS`:

```env
CORS_ORIGINS=https://audit.example.com,https://node.example.com
```

Without this, browser login and audit submissions from Field Kit will be blocked.

### 3d. Deploy and verify

```bash
vercel deploy --prod
```

1. Open the Field Kit URL ? you should land on `/login`.
2. Enter the node URL (pre-filled from `NEXT_PUBLIC_NODE_API_URL`), auditor credentials, and sign in.
3. Search for a property and submit a test audit.
4. Confirm the fact appears on the node dashboard.

Auditors need role `AUDITOR` or `ADMIN`. New registrations default to `USER` (pending approval).

---

## Step 4 ? Connect clients

| Client | Configuration |
| --- | --- |
| **Lens extension** | Load unpacked from `apps/lens/` ? **Extension options** ? set Node URL and sign in |
| **Agency SDK** | Point widget at `https://node.example.com`; add agency origin to `CORS_ORIGINS` |
| **Field Kit** | `NEXT_PUBLIC_NODE_API_URL` env var (users can override in login UI via localStorage) |

---

## Deployment checklist

Use this before going live:

- [ ] PostgreSQL provisioned; `pnpm db:deploy` applied
- [ ] `NODE_URL` matches the production domain exactly
- [ ] RS256 keypair set (`NODE_PRIVATE_KEY`, `NODE_PUBLIC_KEY`)
- [ ] `CRON_SECRET` set; cron routes reachable only with bearer token
- [ ] `CORS_ORIGINS` lists Field Kit, agency sites (not `*` in production)
- [ ] First admin created via `/setup`
- [ ] At least one auditor account promoted
- [ ] Field Kit deployed with `NEXT_PUBLIC_NODE_API_URL`
- [ ] `/api/health` returns 200
- [ ] Test audit from Field Kit appears on node dashboard
- [ ] Lens extension signed in against production node
- [ ] (Optional) `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` set for rate limiting
- [ ] (Optional) `PHOTO_STORAGE_PROVIDER` + credentials set if moving photos off Postgres

---

## Option ? Docker (single node)

For self-hosted deployments without Vercel:

```bash
docker compose -f docker/docker-compose.yml up --build
```

On first run this builds the image, starts Postgres, runs `prisma migrate deploy`, and starts the node on port 3000.

**Verify:**

```bash
curl http://localhost:3000/api/health
```

**Seed (once):**

```bash
docker compose -f docker/docker-compose.yml exec node sh -c "pnpm db:seed"
```

**Customise `docker/docker-compose.yml`:**

```yaml
environment:
  NODE_ID: my-production-node
  NODE_URL: https://wikitraveler.myhotel.com
  NODE_PRIVATE_KEY: <RSA private key PEM>
  NODE_PUBLIC_KEY: <RSA public key PEM>
  OPEN_REGISTRATION: "true"   # set to "false" to close registration
  BOOTSTRAP_PEERS: https://other-node.example.com
  CORS_ORIGINS: "https://myagency.com"
  OPENAI_API_KEY: <optional>
```

**Stop / clean up:**

```bash
docker compose -f docker/docker-compose.yml down        # keeps data
docker compose -f docker/docker-compose.yml down -v   # removes data
```

Field Kit is not included in the Docker compose stack ? deploy it separately on Vercel or run locally with `pnpm dev:field-kit`.

---

## Production hardening

**Secrets:** Never commit `.env` or PEM files. Use Vercel encrypted env vars or Docker secrets.

**Database:** Use a connection pooler (PgBouncer, Neon pooler, Supabase pooler). Serverless functions open many short-lived connections.

**CORS:** Lock `CORS_ORIGINS` to exact production domains. Avoid `*` when handling authenticated audits.

**Rate limiting:** Set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` (from [Upstash](https://upstash.com) ? free tier is sufficient for most nodes) to enable sliding-window rate limiting in Next.js middleware:

| Path | Limit |
| --- | --- |
| `POST /api/auth/login` | 10 req / 60 s per IP |
| `POST /api/auth/register` | 10 req / 60 s per IP |
| `POST /api/properties/*/accessibility` | 20 req / 60 s per IP |

Without these env vars the node runs without rate limiting (safe for private deployments; not recommended for public nodes).

**AI cost control:** Set `MAX_AI_SCAN_PER_RUN` to control how many properties the daily AI scan processes per run (default `20`, hard ceiling `50`). The `?limit=N` query param can override it per-call.

**Photo storage:** Controlled by `PHOTO_STORAGE_PROVIDER`:

| Value | Backend | Extra env vars required |
| --- | --- | --- |
| _(unset)_ | Base64 in Postgres ? zero config, good for demos | ? |
| `r2` | Cloudflare R2 ? 10 GB / 1 M writes free forever | `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_URL` |
| `supabase` | Supabase Storage ? 1 GB free on Supabase free plan | `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SUPABASE_STORAGE_BUCKET` (default: `photos`) |

When switching from base64 to an object-storage backend, run the one-off migration script to upload existing photos and replace the stored data-URIs with URLs:

```bash
PHOTO_STORAGE_PROVIDER=r2 R2_ACCOUNT_ID=... R2_BUCKET=... \
  R2_ACCESS_KEY_ID=... R2_SECRET_ACCESS_KEY=... R2_PUBLIC_URL=https://... \
  DATABASE_URL=postgresql://... \
  pnpm --filter @wikitraveler/node db:migrate-photos
```

The script is idempotent ? rows that already contain HTTPS URLs are skipped.

---

## Environment variable reference

| Variable | Docker default | Node (Vercel) | Field Kit (Vercel) |
| --- | --- | --- | --- |
| `DATABASE_URL` | `postgresql://wikitraveler:wikitraveler@postgres:5432/wikitraveler` | From provider | ? |
| `NODE_ID` | `docker-node-1` | Set in dashboard | ? |
| `NODE_URL` | `http://localhost:3000` | Production URL | ? |
| `NODE_PRIVATE_KEY` | _(empty)_ | **Recommended** | ? |
| `NODE_PUBLIC_KEY` | _(empty)_ | **Recommended** | ? |
| `OPEN_REGISTRATION` | `true` | Set in dashboard | ? |
| `CORS_ORIGINS` | `*` | Locked-down list | ? |
| `BOOTSTRAP_PEERS` | _(empty)_ | Optional | ? |
| `CRON_SECRET` | _(empty)_ | **Required** | ? |
| `OPENAI_API_KEY` / `AI_*` | _(empty)_ | Optional | ? |
| `WHEELMAP_API_KEY` | _(empty)_ | Optional | ? |
| `OSM_BBOX` | Netherlands default | Set per region | ? |
| `MAX_AI_SCAN_PER_RUN` | `20` | Optional (default 20, max 50) | ? |
| `UPSTASH_REDIS_REST_URL` | _(empty)_ | Optional (rate limiting) | ? |
| `UPSTASH_REDIS_REST_TOKEN` | _(empty)_ | Optional (rate limiting) | ? |
| `PHOTO_STORAGE_PROVIDER` | _(empty, base64)_ | Optional: `r2` or `supabase` | ? |
| `R2_ACCOUNT_ID` | _(empty)_ | Required when provider=`r2` | ? |
| `R2_ACCESS_KEY_ID` | _(empty)_ | Required when provider=`r2` | ? |
| `R2_SECRET_ACCESS_KEY` | _(empty)_ | Required when provider=`r2` | ? |
| `R2_BUCKET` | _(empty)_ | Required when provider=`r2` | ? |
| `R2_PUBLIC_URL` | _(empty)_ | Required when provider=`r2` | ? |
| `SUPABASE_URL` | _(empty)_ | Required when provider=`supabase` | ? |
| `SUPABASE_SERVICE_KEY` | _(empty)_ | Required when provider=`supabase` | ? |
| `SUPABASE_STORAGE_BUCKET` | `photos` | Optional when provider=`supabase` | ? |
| `NEXT_PUBLIC_NODE_API_URL` | `http://localhost:3000` (local) | ? | **Required** |
