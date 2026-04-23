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

# Apply migrations
pnpm db:migrate

# Seed sample hotels
pnpm db:seed
```

The seed creates three hotels (Grand Hotel Vienna, Hotel Arts Barcelona, Pulitzer Amsterdam) with `OFFICIAL`-tier facts. Re-running `pnpm db:seed` is safe â€” it uses `upsert`.

| Command | Description |
|---------|-------------|
| `pnpm db:migrate` | Create and apply a new migration |
| `pnpm db:generate` | Regenerate Prisma client after schema changes |
| `pnpm exec prisma studio` | Open Prisma Studio (visual DB browser) |
| `pnpm exec prisma migrate reset` | Drop and recreate the database (dev only) |

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
### Registry

```bash
pnpm dev:registry
# → http://localhost:3002
```

The registry requires its own migration (first time only):

```bash
cd apps/registry
npx prisma migrate dev --name init
```

With `REGISTRY_URL=http://localhost:3002` in `.env`, the node registers itself automatically on startup.
### Agency Demo

```bash
pnpm dev:agency-demo
# â†’ http://localhost:4000/apps/agency-demo/
```

Builds the SDK and serves from the repo root. The demo auto-connects to `http://localhost:3000` and populates a property dropdown.

### Lens Extension

No build step â€” load as unpacked:

1. Chrome â†’ `chrome://extensions` â†’ enable **Developer mode**
2. **Load unpacked** â†’ select `apps/lens/`
3. Lens icon → **Options** → set Node URL to `http://localhost:3000`, then log in

**Two-node local dev** (peer discovery testing):
```bash
# Terminal 1 — node A on port 3000
NODE_ID=node-a NODE_URL=http://localhost:3000 pnpm dev

# Terminal 2 — node B on port 3010
NODE_ID=node-b NODE_URL=http://localhost:3010 BOOTSTRAP_PEERS=http://localhost:3000 PORT=3010 pnpm dev
```
Node B bootstraps by fetching nodeinfo from node A and seeds the local `NodePeer` table. Gossip cron will then exchange facts bidirectionally.

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
| `REGISTRY_URL` | node | No | Legacy: treated as extra bootstrap seed source |
| `GOSSIP_INTERVAL_HOURS` | node | No | Hours between gossip cron runs |
| `CRON_SECRET` | node | No | Bearer token for cron endpoints |
| `OPENAI_API_KEY` | node | No | GPT-4o key; enables AI_GUESS tier features |
| `WHEELMAP_API_KEY` | node | No | Wheelmap API key for OSM wheelchair sync |
| `NEXT_PUBLIC_NODE_API_URL` | field-kit | Yes | Node URL the Field Kit connects to |
