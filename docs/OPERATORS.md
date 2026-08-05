# Operators guide

Run a **WikiTraveler node** in production: API, dashboard, gossip, and cron. Travelers typically use a **hub Access** (canonical `https://access.wikitraveler.org`); deploying Access next to your node is optional branding, not the main mesh story ([RFC-0002](./rfcs/0002-global-hub-access.md)).

**Related:** [Docker](./DOCKER.md) · [Vercel](./VERCEL.md) · [Upgrade](./UPGRADE.md) · [Releases](./RELEASES.md)

---

## Audiences

| Audience | You run | Expectation |
|----------|---------|-------------|
| **Node operators** | Regional Node + OSM + gossip | Allow **trusted hub origins** (`CLIENT_ORIGINS` / `CORS_ORIGINS`); Access optional |
| **Hub operators** | Access PWA (canonical or branded) | Point `NEXT_PUBLIC_NODE_API_URL` at a default home node; keep uptime; list a **backup Access** origin on nodes (**H4**) |

Canonical hub for travelers: **`https://access.wikitraveler.org`**. Additional branded hubs are allowed; each origin must be on every data node’s trusted client allowlist to reach that region.

### Hub outage (H4)

If the canonical hub is down, nodes and gossip still work. Mitigations:

1. Publish a **backup Access** URL (second Vercel/Docker deploy of `apps/access`).
2. Add **both** origins to every public node’s `CLIENT_ORIGINS` (e.g. `https://access.wikitraveler.org,https://access-backup.example.org`).
3. Point travelers at the backup in status pages / COMMUNITY links until the canonical hub recovers.

Access is a client — redeploying it does not require node DB migrations.

---

## What you are running

| Component | Required? | Role |
|-----------|-----------|------|
| **Node** (`apps/node`) | **Yes** | PostgreSQL-backed API, admin, gossip, crons — holds truth |
| **WikiTraveler Access** (`apps/access`) | No* | Mobile PWA; hub operators run the global door; node operators may run a branded regional Access |
| **Lens** | No | Chrome extension; home node = identity; background fetch to regional data nodes |
| **SDK** | No | Embedded by agencies; calls your node URL |

\*Most travelers use the **canonical hub**, not a per-node Access. Do not assume “deploy Access only for my node’s travelers” is the primary path.

Each node is **sovereign**: your `NODE_ID`, keys, region bbox, database, and upgrade schedule.

---

## Choose a hosting model

| Model | Best for | Guide |
|-------|----------|-------|
| **Docker Compose** | VPS, on-prem, full control, large OSM PBF ingest | [DOCKER.md](./DOCKER.md) |
| **Vercel + hosted Postgres** | Low-ops serverless, automatic crons | [VERCEL.md](./VERCEL.md) |
| **Hybrid** | Ingest on Docker/local, serve API on Vercel with shared `DATABASE_URL` | [LOCAL.md](./LOCAL.md) ingest → [VERCEL.md](./VERCEL.md) |

**OSM rule of thumb:** run the **first large ingest** (country or Benelux scale) on local dev or Docker, then point production at the same database or import a gzip export.

---

## First-time production checklist

### 1. Identity & security

- [ ] Stable `NODE_ID` and public `NODE_URL`
- [ ] RS256 keypair (`NODE_PRIVATE_KEY` / `NODE_PUBLIC_KEY`)
- [ ] `CRON_SECRET` for cron routes (Vercel required; recommended for Docker)
- [ ] `CORS_ORIGINS` / `CLIENT_ORIGINS` allow the **canonical hub** (`https://access.wikitraveler.org`), any **backup / branded** Access origins, Lens `chrome-extension://…` (when you know the Store/extension ID), and SDK embed origins — see [RFC-0002](./rfcs/0002-global-hub-access.md)
- [ ] Optional `ACCESS_PUBLIC_URL` if this node advertises a preferred Access on `/api/nodeinfo` (hubs/directory only — **not** automatic CORS trust from gossip)
- [ ] Rate limiting via Upstash (recommended for public nodes) — see [VERCEL.md](./VERCEL.md)

**Never in production:**

- [ ] Do **not** deploy without `NODE_PRIVATE_KEY` / `NODE_PUBLIC_KEY` (HS256 fallback is dev-only)
- [ ] Do **not** leave `CORS_ORIGINS=*` unless intentional
- [ ] Do **not** auto-trust gossiped `accessUrl` values for CORS
- [ ] Do **not** commit `.env` or paste secrets into issues

Report vulnerabilities: [SECURITY.md](../SECURITY.md) (private reporting, not public issues).

### 2. Database

- [ ] PostgreSQL provisioned (Neon, Supabase, self-hosted, or Compose)
- [ ] `pnpm db:deploy` applied once before first app start
- [ ] Backups configured (provider snapshots or Admin gzip export)

### 3. Deploy the node

- [ ] Docker: `docker compose -f docker/docker-compose.yml up --build -d`
- [ ] Vercel: two-project setup — node project per [VERCEL.md](./VERCEL.md)
- [ ] Complete `/setup` — create first admin
- [ ] Admin → **Region & OSM ingest** — set bbox and ingest baseline data

### 4. Federation (optional)

- [ ] `BOOTSTRAP_PEERS` lists trusted peer URLs
- [ ] Peers can reach your `NODE_URL` over HTTPS
- [ ] Verify: `GET /api/nodeinfo` returns `publicKeyPem` and peers

### 5. WikiTraveler Access (optional for node ops; required for hub ops)

**Node operators:** prefer pointing travelers to the canonical hub. If you run a branded Access:

- [ ] Separate deploy with `NEXT_PUBLIC_NODE_API_URL` = your node URL (default home)
- [ ] Rebuild Access whenever that URL changes (build-time env)
- [ ] Ensure **your** Access origin is on **peer** nodes’ `CLIENT_ORIGINS` if users leave your region
- [ ] Docker (both apps): `pnpm docker:stack` — see [DOCKER.md](./DOCKER.md#node--access-stack)
- [ ] Docker (Access profile on node-only compose): `pnpm docker:access`

**Hub operators:** deploy Access separately; keep a backup URL; document both in COMMUNITY / status.

### 6. Verify

See [OPERATOR-CHECKLIST.md](./OPERATOR-CHECKLIST.md) for the full post-deploy list.

```bash
pnpm doctor   # or: NODE_URL=https://your-node.example.com pnpm doctor

curl -s https://your-node.example.com/api/health | jq .
# Expect: ok, version, nodeId

curl -s https://your-node.example.com/api/nodeinfo | jq .
# Expect: nodeId, url, version, publicKeyPem
```

---

## Crons & background work

| Job | Schedule | Purpose |
|-----|----------|---------|
| `/api/cron/gossip` | Every 6h | Peer fact sync (fallback path) |
| `/api/cron/ai-scan` | Daily | AI gap-fill for uncovered properties |
| `/api/cron/wheelmap-sync` | Daily | Wheelmap integration |

Configured in [`vercel.json`](../vercel.json) for Vercel. Docker operators schedule equivalent HTTP calls with `CRON_SECRET`.

**Not on Vercel:** large OSM ingest — use CLI (`pnpm node:ingest`) on Docker or local.

---

## Multi-environment strategy

| Environment | Purpose | Suggested ref |
|-------------|---------|---------------|
| **Production** | Live travelers | Git tag `v*` |
| **Staging** | Pre-upgrade validation | Previous tag or RC branch |
| **Dev** | Feature work | `main` locally only |

Pin production to **release tags**, not floating `main`, once the community depends on your node.

---

## Upgrades & releases

Operators upgrade on their own schedule:

1. Read [CHANGELOG.md](../CHANGELOG.md) for the target version.
2. Follow [UPGRADE.md](./UPGRADE.md) for Docker or Vercel.
3. Check [RELEASES.md](./RELEASES.md) for gossip compatibility notes.

You are **not** required to upgrade for every release unless a security advisory says otherwise.

---

## Getting help

- Deployment issues → GitHub issue with **Operator help** template
- Federation issues → include `/api/nodeinfo` from both peers and `pnpm gossip:check` output
- Security → [SECURITY.md](../SECURITY.md) (do not file public issues for vulnerabilities)

---

## Next steps

| Task | Doc |
|------|-----|
| Self-host with Docker | [DOCKER.md](./DOCKER.md) |
| Deploy on Vercel | [VERCEL.md](./VERCEL.md) |
| Upgrade existing node | [UPGRADE.md](./UPGRADE.md) |
| Understand gossip | [ARCHITECTURE.md](./ARCHITECTURE.md) |
