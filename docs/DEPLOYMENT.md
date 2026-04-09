# Deployment Guide

---

## Option 1 — Docker (single node)

```bash
docker compose -f docker/docker-compose.yml up --build
```

On first run this builds the image, starts Postgres, runs `prisma migrate deploy`, and starts the node on port 3000. Subsequent starts are instant.

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
  COMMUNITY_PASSPHRASE: <strong passphrase>
  JWT_SECRET: <64-char random hex>
  CORS_ORIGINS: "https://myagency.com"
  OPENAI_API_KEY: <optional>
```

Never commit real secrets — use Docker secrets or an env file outside version control.

**Stop / clean up:**
```bash
docker compose -f docker/docker-compose.yml down        # keeps data
docker compose -f docker/docker-compose.yml down -v     # removes data
```

---

## Option 2 — Vercel

Deploy `apps/node` as a serverless Next.js app. The database must be externally hosted (Vercel Postgres, Neon, or Supabase).

**1. Set environment variables in Vercel:**

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `NODE_ID` | Stable unique name for this deployment |
| `NODE_URL` | Your Vercel URL, e.g. `https://wiki.myhotel.com` |
| `JWT_SECRET` | Long random string |
| `COMMUNITY_PASSPHRASE` | Shared auditor password |
| `CORS_ORIGINS` | `*` or comma-separated agency origins |
| `CRON_SECRET` | Protects cron endpoints |
| `BOOTSTRAP_PEERS` | Comma-separated peer node URLs (optional) |
| `REGISTRY_URL` | URL of the central registry; node registers on startup (optional) |
| `OPENAI_API_KEY` | GPT-4o key (optional — disables AI if absent) |
| `NODE_PRIVATE_KEY` | RSA private key PEM for signing inbox pushes (optional) |
| `NODE_PUBLIC_KEY` | Corresponding RSA public key PEM (optional) |
| `WHEELMAP_API_KEY` | Wheelmap API key for OSM sync (optional) |

Generate a keypair if you want signed gossip:
```bash
openssl genrsa -out node_private.pem 2048
openssl rsa -in node_private.pem -pubout -out node_public.pem
```

**2. Deploy:**
```bash
cd apps/node
vercel deploy --prod
```

Or connect the GitHub repo in the Vercel dashboard with **Root Directory** set to `apps/node`.

**3. Run migrations:**
```bash
DATABASE_URL=<prod-url> pnpm exec prisma migrate deploy
```

**4. Seed (once):**
```bash
DATABASE_URL=<prod-url> pnpm db:seed
```

**5. Register peers:**
```bash
curl -X POST https://node-a.vercel.app/api/nodes \
  -H "Content-Type: application/json" \
  -d '{"url":"https://node-b.vercel.app"}'
```

Or set `BOOTSTRAP_PEERS` on each node — the gossip cron auto-registers on first run.

**Cron schedule** (configured in `vercel.json`):

| Job | Schedule |
|-----|----------|
| `/api/cron/gossip` | Every 6 hours |
| `/api/cron/ai-scan` | Daily at 02:00 |
| `/api/cron/wheelmap-sync` | Daily at 03:00 |

---

## Production Hardening

**Secrets:** Generate `JWT_SECRET` with:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

**CORS:** Set `CORS_ORIGINS` to your exact agency domains. Avoid `*` if you handle sensitive audits.

**Database:** Use a connection pooler (PgBouncer or Supabase pooler) for Vercel. Enable `?sslmode=require` on `DATABASE_URL`.

**Rate limiting:** The node has no built-in rate limiting. Put it behind a reverse proxy (nginx, Caddy, or a Vercel Edge Config rule) that limits `/api/auth/token` and `/api/properties/*/accessibility`.

**AI cost control:** The `?limit=N` param on `/api/cron/ai-scan` caps properties processed per run (default 20, max 50). AI facts are always overwritten by field audits, so costs decrease naturally as the community grows.

**Photo storage:** Photos are stored as base64 in Postgres for the MVP. For high-volume production, switch to S3/R2/Supabase Storage and store URLs instead.

---

## Environment Variable Reference

| Variable | Docker default | Vercel |
|----------|---------------|--------|
| `DATABASE_URL` | `postgresql://wikitraveler:wikitraveler@postgres:5432/wikitraveler` | From provider |
| `NODE_ID` | `docker-node-1` | Set in dashboard |
| `NODE_URL` | `http://localhost:3000` | Set in dashboard |
| `JWT_SECRET` | `change-me-in-production` | Set in dashboard |
| `COMMUNITY_PASSPHRASE` | `changeme` | Set in dashboard |
| `CORS_ORIGINS` | `*` | `*` or locked-down list |
| `BOOTSTRAP_PEERS` | _(empty)_ | Optional |
| `REGISTRY_URL` | _(empty — auto-registration disabled)_ | Optional |
| `CRON_SECRET` | _(empty)_ | Set in dashboard |
| `OPENAI_API_KEY` | _(empty — AI disabled)_ | Optional |
| `NODE_PRIVATE_KEY` | _(empty — signing disabled)_ | Optional |
| `NODE_PUBLIC_KEY` | _(empty)_ | Optional |
| `WHEELMAP_API_KEY` | _(empty — sync disabled)_ | Optional |
