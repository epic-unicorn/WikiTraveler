# Development guide

Monorepo workflow for contributors building node, Access, Lens, SDK, and shared packages.

**Setup:** [LOCAL.md](./LOCAL.md) · **Flows:** [apps/README.md](../apps/README.md) · **Federation:** [GOSSIP-DEV.md](./GOSSIP-DEV.md) · **Contributing:** [CONTRIBUTING.md](../CONTRIBUTING.md)

---

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | v20+ |
| pnpm | v9+ |
| Docker | Postgres container |
| Chrome | Lens extension dev |

---

## First-time setup

```bash
git clone https://github.com/ingmarstruijs/WikiTraveler.git
cd wikitraveler
pnpm install
cp .env.example .env
docker compose -f docker/docker-compose.dev.yml up postgres -d
pnpm db:setup
```

Then `pnpm dev` and complete `/setup`. Full detail: [LOCAL.md](./LOCAL.md).

---

## Monorepo layout

| Path | Package | Role |
|------|---------|------|
| `apps/node` | `@wikitraveler/node` | API + dashboard |
| `apps/access` | `@wikitraveler/access` | Mobile PWA |
| `apps/lens` | — | Chrome MV3 (no package.json) |
| `packages/core` | `@wikitraveler/core` | Types, merge, tiers |
| `packages/sdk` | `@wikitraveler/sdk` | Agency embed |
| `packages/ui` | `@wikitraveler/ui` | Shared React |
| `packages/i18n` | `@wikitraveler/i18n` | Locales |
| `packages/ai-agent` | `@wikitraveler/ai-agent` | Vision + gap-fill |
| `prisma/` | — | Shared schema |

**Build order** (root `pnpm build`): core → i18n → ui → ai-agent → sdk → node → access.

Filter to one app:

```bash
pnpm --filter @wikitraveler/node dev
pnpm --filter @wikitraveler/access test
```

---

## Daily commands

| Terminal | Command | URL |
|----------|---------|-----|
| 1 | `pnpm dev` | http://localhost:3000 — node |
| 2 | `pnpm dev:access` | http://localhost:3001 — Access |
| 3 | `pnpm dev:agency-demo` | http://localhost:4000/apps/agency-demo/ |

After pulling schema changes on an existing DB: `pnpm db:migrate` (not `db:setup`).

---

## Scripts

### Apps & build

| Script | Description |
|--------|-------------|
| `pnpm dev` | Node dev server |
| `pnpm dev:access` | Access dev server |
| `pnpm dev:agency-demo` | SDK build + static demo |
| `pnpm build` | Production build all packages |
| `pnpm lint` | Lint all workspaces |
| `pnpm test` | Unit tests (node + access) |

### Database

| Script | Description |
|--------|-------------|
| `pnpm db:setup` | **Destructive local reset** + migrate + seed fields |
| `pnpm db:migrate` | Apply pending migrations (keep data) |
| `pnpm db:deploy` | Production migrations (no interactive) |
| `pnpm db:seed` | Sample OSM fixture |

### Node CLI (offline / ops)

| Script | Description |
|--------|-------------|
| `pnpm node:region` | Set bbox (`--preset eindhoven` or `--bbox`) |
| `pnpm node:ingest` | OSM: `overpass`, `pbf`, `geojson` |
| `pnpm node:export` / `node:import` | Gzip JSON transfer (schema v2) |
| `pnpm node:build-sample` | Bundle Admin sample gzip |
| `pnpm geocode:missing` | Nominatim backfill |

### Quality & federation

| Script | Description |
|--------|-------------|
| `pnpm test:a11y` | axe accessibility regression |
| `pnpm lighthouse:ci` | Lighthouse gate (apps must be running) |
| `pnpm dev:gossip-lab` | Two-node Docker gossip lab |
| `pnpm gossip:check` | Peer smoke test |
| `pnpm doctor` | Operator health check (version, migrations, peers, keys) |
| `pnpm release:prepare` | Bump versions — `node scripts/release.mjs X.Y.Z` |
| `pnpm gossip:sync` | Manual cron gossip on lab nodes |

Maintainer-only: `pnpm db:migrate-photos` — see [VERCEL.md](./VERCEL.md).

### Dependency updates

**Alerts yes, auto-PRs no:**

| What | How |
|------|-----|
| See vulnerabilities | **Security** tab (Dependabot alerts — keep **enabled** in repo Settings) |
| Version bump PRs | **Off** — no `.github/dependabot.yml` |
| Security fix PRs | **Off** — Settings → Code security and analysis → disable **Dependabot security updates** |

Bump deps manually when alerts or releases require it. See [SECURITY.md](../SECURITY.md).

---

## Pull request workflow

1. Branch from `main`: `feature/short-description` or `fix/issue-N-description`.
2. Run `pnpm test` and `pnpm build` before opening PR.
3. UI changes: `pnpm test:a11y` (and Lighthouse if substantial).
4. Federation changes: gossip lab per [GOSSIP-DEV.md](./GOSSIP-DEV.md).
5. Fill PR template — include operator impact if any.

See [CONTRIBUTING.md](../CONTRIBUTING.md) for review expectations.

---

## Environment variables

Reference: [`.env.example`](../.env.example)

| Variable | Dev | Production |
|----------|-----|------------|
| `DATABASE_URL` | Local Postgres | Hosted Postgres |
| `NODE_PRIVATE_KEY` / `NODE_PUBLIC_KEY` | Optional locally | Required for federation |
| `NEXT_PUBLIC_NODE_API_URL` | Access dev proxy default | Build-time on Access deploy |
| `AI_*` / `OPENAI_API_KEY` | Optional | Optional |

---

## Testing flows end-to-end

| Flow | Doc |
|------|-----|
| Agency SDK widget | [apps/README.md](../apps/README.md) Flow 1 |
| WikiTraveler Access | Flow 2 |
| Lens extension | Flow 3 |
| Admin / OSM ingest | [LOCAL.md](./LOCAL.md) |
| Two-node gossip | [GOSSIP-DEV.md](./GOSSIP-DEV.md) |

---

## Accessibility

Target: **WCAG 2.1 Level AA**. Checklist: [ACCESSIBILITY.md](./ACCESSIBILITY.md). CI runs axe + Lighthouse on PRs.

---

## Release awareness

Contributors do not tag releases. When your PR affects operators:

- Note migration requirements in PR description.
- Maintainers update [CHANGELOG.md](../CHANGELOG.md) and [versions.json](../versions.json) at tag time.

Policy: [RELEASES.md](./RELEASES.md).
