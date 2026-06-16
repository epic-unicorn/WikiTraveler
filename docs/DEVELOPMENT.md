# Development Guide

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | v20+ | https://nodejs.org |
| pnpm | v9+ | `npm install -g pnpm` |
| Docker Desktop | any | https://www.docker.com |
| Chrome | any | for the Lens extension |

---

## First-Time Setup

```bash
# Install dependencies
pnpm install

# Copy and fill in the env file
cp .env.example .env
```

Minimum required variables in `.env`:

```env
DATABASE_URL=postgresql://wikitraveler:wikitraveler@localhost:5432/wikitraveler
# RS256 keypair — generate with:
#   openssl genrsa -out node_private.pem 2048 && openssl rsa -in node_private.pem -pubout -out node_public.pem
NODE_PRIVATE_KEY=
NODE_PUBLIC_KEY=
```

---

## Database Setup

```bash
# Start Postgres
docker compose -f docker/docker-compose.dev.yml up postgres -d

# Fresh local database: migrations + OSM fixture ingest
pnpm db:setup
```

`db:setup` runs `prisma migrate reset` and ingests the committed OSM fixture in `scripts/fixtures/` (`OFFICIAL`-tier baseline). Re-running it wipes local data.

After pulling schema changes on an existing database, use `pnpm db:migrate` instead.

| Command | Description |
|---------|-------------|
| `pnpm db:setup` | Reset DB, migrate, ingest OSM fixture |
| `pnpm db:migrate` | Apply pending migrations (keep data) |
| `pnpm db:seed` | Re-ingest fixture only (no reset) |
| `pnpm osm:ingest` | Fetch fresh OSM data from Overpass and update the fixture |
| `pnpm exec prisma studio` | Open Prisma Studio (visual DB browser) |

---

## Running Locally

### Node

```bash
pnpm dev
# â†’ http://localhost:3000
```

### Field Kit

```bash
pnpm dev:field-kit
# â†’ http://localhost:3001
```

Open in a mobile browser or use Chrome DevTools device emulation.
### Agency Demo

```bash
pnpm dev:agency-demo
# â†’ http://localhost:4000/apps/agency-demo/
```

Builds the SDK and serves from the repo root. The demo connects to `http://localhost:3000` by default.

### Lens Extension

No build step â€” load as unpacked:

1. Chrome â†’ `chrome://extensions` â†’ enable **Developer mode**
2. **Load unpacked** â†’ select `apps/lens/`
3. Click the Lens icon → enter your node credentials and **Sign in**
   - First time? Click **Register on node →** — this opens `http://localhost:3000/register` in a new tab.
   - Register creates a `USER` account. Promote it to `AUDITOR` via the node dashboard (Stats → Users) before the extension can show data.
4. Lens icon → **Extension options** → set Node URL, sign in, and confirm connection

**Two-node local dev** (peer gossip testing): use the gossip lab instead of ad-hoc env vars — see [docs/GOSSIP-DEV.md](../docs/GOSSIP-DEV.md) and `pnpm dev:gossip-lab`.

---

## Building Packages

```bash
# All packages (production)
pnpm build

# Individual
pnpm --filter @wikitraveler/core build
pnpm --filter @wikitraveler/ai-agent build
pnpm --filter @wikitraveler/sdk build
pnpm --filter @wikitraveler/node build
pnpm --filter @wikitraveler/field-kit build
```

Build order: `core` â†’ `ai-agent` â†’ `sdk` â†’ `node` / `field-kit`.

---

## Environment Variables

| Variable | Used by | Required | Description |
|----------|---------|----------|-------------|
| `DATABASE_URL` | node | Yes | PostgreSQL URL |
| `NODE_ID` | node | No | Stable unique ID for this node |
| `NODE_URL` | node | No | Public-facing URL of this node |
| `NODE_PRIVATE_KEY` | node | No | RSA private key PEM — enables RS256 JWT signing and cross-node auth |
| `NODE_PUBLIC_KEY` | node | No | Corresponding RSA public key PEM |
| `OPEN_REGISTRATION` | node | No | `"true"` (default) or `"false"` to close public registration |
| `CORS_ORIGINS` | node | No | Allowed CORS origins (`*` or comma list) |
| `BOOTSTRAP_PEERS` | node | No | Seed node URLs, comma-separated, fetched on startup |
| `GOSSIP_INTERVAL_HOURS` | node | No | Hours between gossip cron runs |
| `CRON_SECRET` | node | No | Bearer token for cron endpoints |
| `OPENAI_API_KEY` | node | No | GPT-4o key; enables AI_GUESS tier features |
| `WHEELMAP_API_KEY` | node | No | Wheelmap API key for OSM wheelchair sync |
| `NEXT_PUBLIC_NODE_API_URL` | field-kit | Yes | Node URL the Field Kit connects to |
