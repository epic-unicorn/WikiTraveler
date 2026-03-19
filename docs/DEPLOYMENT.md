# Deployment Guide

WikiTraveler nodes can be deployed in three ways: Docker (single node), Docker (two-node gossip demo), and Vercel. This guide covers each path and production hardening recommendations.

---

## Option 1 — Docker Single Node

The simplest production deployment. One node, one database, everything containerised.

### Prerequisites

- Docker Desktop (or Docker Engine + Docker Compose v2) installed and running
- Ports 3000 and 5432 available on the host

### Steps

**1. Build and start**

```bash
docker compose -f docker/docker-compose.yml up --build
```

The first run builds the image (≈ 2–3 minutes) and then:
- Starts a PostgreSQL 16 container
- Waits for Postgres to be healthy
- Runs `prisma migrate deploy` inside the node container
- Starts the Next.js server on port 3000

**2. Verify**

```bash
curl http://localhost:3000/api/health
```

**3. Seed initial data**

```bash
docker exec -it <node-container-name> sh -c "pnpm db:seed"
# Or run from your host (requires DATABASE_URL in .env pointing at the container):
# pnpm db:seed
```

**4. Open the dashboard**

Visit `http://localhost:3000` in your browser.

### Stopping and cleaning up

```bash
# Stop containers (keeps data volume)
docker compose -f docker/docker-compose.yml down

# Stop and remove all data
docker compose -f docker/docker-compose.yml down -v
```

### Customising the compose file

Edit `docker/docker-compose.yml` to override environment variables:

```yaml
environment:
  NODE_ID: my-production-node
  NODE_URL: https://wikitraveler.myhotel.com
  COMMUNITY_PASSPHRASE: <strong passphrase>
  JWT_SECRET: <64-char random hex>
  CORS_ORIGINS: "https://myhotelbooking.com,https://app.myhotel.com"
  SEED_NODES: "https://other-node.example.com"
  OPENAI_API_KEY: <your-openai-key>  # optional — remove to disable AI
```

Never commit real secrets — use Docker secrets or an env file excluded from version control.

---

## Option 2 — Docker Two-Node Gossip Demo

Runs two isolated nodes that sync accessibility facts via the gossip protocol every 10 seconds. Useful for demonstrating mesh behaviour and `MESH_TRUTH` promotion.

### Steps

**1. Start the demo**

```bash
docker compose -f docker/docker-compose.gossip-demo.yml up --build
```

This brings up:
- `postgres` (shared DB between both nodes)
- `node-a` on port 3000, `NODE_ID=node-a`, knows about node-b
- `node-b` on port 3001, `NODE_ID=node-b`, knows about node-a
- `gossip-scheduler` — a curl container that hits `/api/cron/gossip` on each node every 10 seconds

**2. Get a JWT from node-a**

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/token \
  -H "Content-Type: application/json" \
  -d '{"passphrase":"demo"}' | jq -r .token)
```

**3. Submit a community audit to node-a**

First, find a property ID from the dashboard at `http://localhost:3000`, then:

```bash
curl -X POST http://localhost:3000/api/properties/<prop-id>/accessibility \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"facts":[{"fieldName":"ramp_present","value":"yes"},{"fieldName":"door_width_cm","value":"90"}]}'
```

**4. Wait 10 seconds for gossip to fire**

The `gossip-scheduler` container triggers the cron on both nodes every 10 seconds.

**5. Check that node-b received the fact**

```bash
curl http://localhost:3001/api/properties/<prop-id>/accessibility
```

You will see the fact with `tier: "COMMUNITY"` and `sourceNodeId: "node-a"`.

**6. Submit the same fact from node-b**

```bash
TOKEN_B=$(curl -s -X POST http://localhost:3001/api/auth/token \
  -H "Content-Type: application/json" \
  -d '{"passphrase":"demo"}' | jq -r .token)

curl -X POST http://localhost:3001/api/properties/<prop-id>/accessibility \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN_B" \
  -d '{"facts":[{"fieldName":"ramp_present","value":"yes"}]}'
```

After the next gossip cycle, both nodes will see the fact from two distinct `sourceNodeId` values. Once ≥ 3 nodes agree, it is promoted to `MESH_TRUTH`.

### Viewing logs

```bash
# All services
docker compose -f docker/docker-compose.gossip-demo.yml logs -f

# Just node-a
docker compose -f docker/docker-compose.gossip-demo.yml logs -f node-a
```

---

## Option 3 — Vercel

Deploy `apps/node` as a serverless Next.js application. The database must be externally hosted (Vercel Postgres, Neon, Supabase, or any PostgreSQL provider).

### Prerequisites

- A Vercel account
- A PostgreSQL database (Vercel Postgres recommended — one-click from the Vercel dashboard)
- The Vercel CLI: `npm install -g vercel`

### Steps

**1. Create env variables in Vercel**

In the Vercel project settings (or via CLI), set these environment variables. Names prefixed with `@` are Vercel secret references:

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | Your PostgreSQL connection string |
| `NODE_ID` | A stable unique name for this deployment |
| `NODE_URL` | Your Vercel deployment URL, e.g. `https://wikitraveler.vercel.app` |
| `JWT_SECRET` | A long random string |
| `COMMUNITY_PASSPHRASE` | Shared auditor password |
| `CORS_ORIGINS` | `*` or your agency domains |
| `CRON_SECRET` | A secret that Vercel will pass to the cron endpoint |
| `OPENAI_API_KEY` | Your OpenAI API key (optional — leave blank to disable AI features) |
| `NODE_PRIVATE_KEY` | RSA private key PEM — signs outgoing inbox pushes (optional but recommended) |
| `NODE_PUBLIC_KEY` | Corresponding RSA public key PEM — served at `/api/nodeinfo` for peer verification |
| `BOOTSTRAP_PEERS` | Comma-separated peer node URLs — seeded into `NodePeer` on first boot |
| `WHEELMAP_API_KEY` | Wheelmap API key — enables OSM wheelchair data sync (optional) |

**Generating a node keypair:**

```bash
openssl genrsa -out node_private.pem 2048
openssl rsa -in node_private.pem -pubout -out node_public.pem
```

Store the PEM content as Vercel secrets. Multi-line PEM values should be stored with literal `\n` characters (single-line escaped format) — the node normalises them back automatically.

The `vercel.json` references these as `@node-id`, `@node-url`, etc. Create matching Vercel secrets with those names.

**2. Deploy**

```bash
cd apps/node
vercel deploy --prod
```

Or connect the GitHub repo in the Vercel dashboard with **Root Directory** set to `apps/node`.

**3. Run the initial migration**

You cannot run `prisma migrate dev` against a production database. Use `prisma migrate deploy` instead:

```bash
DATABASE_URL=<your-prod-url> pnpm exec prisma migrate deploy
```

Or add a build command in `vercel.json`:

```json
{
  "buildCommand": "pnpm exec prisma migrate deploy && pnpm --filter @wikitraveler/node build"
}
```

**4. Seed (once)**

```bash
DATABASE_URL=<your-prod-url> pnpm db:seed
```

**5. Verify the cron**

The `vercel.json` cron configuration fires three scheduled jobs:

```json
{
  "crons": [
    { "path": "/api/cron/gossip",        "schedule": "0 */6 * * *" },
    { "path": "/api/cron/ai-scan",       "schedule": "0 2 * * *"   },
    { "path": "/api/cron/wheelmap-sync", "schedule": "0 3 * * *"   }
  ]
}
```

The `wheelmap-sync` cron fetches current OSM wheelchair ratings for any property that has a `wheelmapId` set. It only creates `OFFICIAL`-tier facts and never downgrades `VERIFIED` or `CONFIRMED` data.

Check cron logs in the Vercel dashboard under **Logs → Cron Jobs**.

The `ai-scan` cron gap-fills up to 20 properties per run by default. Adjust with the `?limit=N` query param (max 50) if you need faster initial coverage.

### Registering peers

Once two Vercel nodes are live, register them as peers of each other:

```bash
# Register node-b as a peer of node-a
curl -X POST https://node-a.vercel.app/api/nodes \
  -H "Content-Type: application/json" \
  -d '{"url":"https://node-b.vercel.app"}'

# Register node-a as a peer of node-b
curl -X POST https://node-b.vercel.app/api/nodes \
  -H "Content-Type: application/json" \
  -d '{"url":"https://node-a.vercel.app"}'
```

Alternatively, set `SEED_NODES` on each node to the other node's URL. The cron will auto-register peers from `SEED_NODES` on first run.

---

## Dockerfile Reference

The Dockerfile at `docker/Dockerfile` uses a three-stage build:

```
Stage 1 (deps)     — install dependencies with pnpm
Stage 2 (builder)  — build core, generate Prisma client, build Next.js
Stage 3 (runner)   — copy only the standalone output and Prisma binary
```

The standalone output (`output: "standalone"` in `next.config.js`) copies only the minimum files needed at runtime, keeping the final image small.

**Entrypoint (`docker/entrypoint.sh`):**

```bash
prisma migrate deploy    # idempotent — applies any pending migrations
node apps/node/server.js # start the Next.js standalone server
```

Migrations run on every container start. If there are no pending migrations, the command is a no-op and startup is fast.

---

## Production Hardening

### Secrets

- Never use `changeme` or `demo-secret-*` in production.
- Generate `JWT_SECRET` with: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`
- Store all secrets in your platform's secret manager (Vercel environment variables, Docker secrets, or a secrets manager like Doppler).

### CORS

Set `CORS_ORIGINS` to the exact domains that need to call the API:

```env
CORS_ORIGINS=https://myagency.com,https://bookings.myagency.com
```

Avoid `*` in production if you have sensitive audit submissions.

### Database

- Use a connection pooler (PgBouncer or Supabase's pooler) for serverless/Vercel deployments to avoid exhausting Postgres connections.
- Enable SSL on the Postgres connection: `DATABASE_URL=postgresql://...?sslmode=require`
- Enable regular automated backups on your database provider.

### Cron secret

Always set `CRON_SECRET` on any internet-facing node. Without it, anyone can trigger gossip pulls:

```env
CRON_SECRET=<random 32+ char string>
```

On Vercel, the cron trigger sends the secret automatically; you only need to match it.

### Rate limiting

The node does not include built-in rate limiting. For production, put it behind a reverse proxy (nginx, Caddy, or a Vercel Edge Config rule) that limits requests to `/api/auth/token` and `/api/properties/*/accessibility`.

### Photo storage

The current MVP stores photos as base64 strings inside the PostgreSQL `AuditSubmission.photoUrls` JSON column. For production with high audit volume:

1. Upload photos to object storage (S3, Cloudflare R2, Supabase Storage).
2. Store the resulting URLs in `photoUrls` instead of base64 strings.
3. Add a maximum file-size check before accepting uploads.

### AI Agent

`OPENAI_API_KEY` is entirely optional. If the key is absent, all AI features silently disable and the node operates as a pure community-audit mesh.

When it is set:
- Vision analysis fires automatically when photos are submitted via the Field Kit (fire-and-forget, non-blocking).
- Gap-fill for properties with no AI coverage runs nightly via the `ai-scan` cron.
- On-demand analysis is available via `POST /api/properties/[id]/analyze`.

Cost control tips:
- The `?limit=N` query param on `/api/cron/ai-scan` limits how many properties are gap-filled per run (default 20, max 50). Lower it if your OpenAI spend is a concern.
- Vision requests consume more tokens than gap-fill. Photos stored as base64 are sent as data URIs; switching to hosted URLs saves token throughput.
- AI-generated facts are tagged `AI_GUESS` (tier rank 1) and are always overwritten by `COMMUNITY` (rank 2) or `MESH_TRUTH` (rank 3) data — so AI costs decrease naturally as the community contributes real audits.

---

## Environment Variable Quick Reference

| Variable | Docker default | Vercel |
|----------|---------------|--------|
| `DATABASE_URL` | `postgresql://wikitraveler:wikitraveler@postgres:5432/wikitraveler` | From provider |
| `NODE_ID` | `docker-node-1` | `@node-id` secret |
| `NODE_URL` | `http://localhost:3000` | `@node-url` secret |
| `JWT_SECRET` | `change-me-in-production` | `@jwt-secret` secret |
| `COMMUNITY_PASSPHRASE` | `changeme` | `@community-passphrase` secret |
| `CORS_ORIGINS` | `*` | `*` (or locked-down list) |
| `BOOTSTRAP_PEERS` | _(empty)_ | `@bootstrap-peers` secret |
| `CRON_SECRET` | _(empty)_ | `@cron-secret` secret |
| `OPENAI_API_KEY` | _(empty — AI disabled)_ | `@openai-api-key` secret |
| `NODE_PRIVATE_KEY` | _(empty — push signing disabled)_ | `@node-private-key` secret |
| `NODE_PUBLIC_KEY` | _(empty)_ | `@node-public-key` secret |
| `WHEELMAP_API_KEY` | _(empty — Wheelmap sync disabled)_ | `@wheelmap-api-key` secret |
| `NODE_ENV` | `production` | `production` (set by Vercel) |
