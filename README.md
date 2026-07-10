<p align="center">
  <img src="docs/assets/wikitraveler-mark.svg" width="72" alt="WikiTraveler logo" />
</p>

<h1 align="center">WikiTraveler</h1>

<p align="center">
  <strong>Open-source, federated accessibility intelligence for travel.</strong><br />
  Verified facts from the field — community-owned, free to use, no central gatekeeper.
</p>

<p align="center">
  <a href="docs/README.md"><strong>Documentation</strong></a> ·
  <a href="CONTRIBUTING.md">Contributing</a> ·
  <a href="CHANGELOG.md">Changelog</a> ·
  <a href="CODE_OF_CONDUCT.md">Code of Conduct</a>
</p>

---

## What it is

Corporate travel sites often lack reliable accessibility information. WikiTraveler treats that as a **protocol problem**: structured facts, clear trust tiers, and a **peer mesh** of independently operated nodes that gossip verified data.

| Tier | Label | Meaning |
|------|-------|---------|
| 0 | `OFFICIAL` | OpenStreetMap / Wikidata baseline |
| 1 | `AI_GUESS` | Machine estimate to guide auditors |
| 2 | `VERIFIED` | Ground truth from a field audit |
| 3 | `CONFIRMED` | ≥3 independent auditors agree |

Higher tiers win on merge. Details: [Architecture](docs/ARCHITECTURE.md).

---

## Choose your path

| I want to… | Start here |
|------------|------------|
| **Run a production node** | [Operators guide](docs/OPERATORS.md) → [Docker](docs/DOCKER.md) or [Vercel](docs/VERCEL.md) |
| **Develop or contribute** | [Development guide](docs/DEVELOPMENT.md) → [Contributing](CONTRIBUTING.md) |
| **Join the community** | [Community guide](docs/COMMUNITY.md) |
| **Upgrade a deployment** | [Upgrade runbook](docs/UPGRADE.md) |
| **Understand the system** | [Architecture](docs/ARCHITECTURE.md) |

**Full documentation index:** [docs/README.md](docs/README.md)

---

## Toolkit

| Component | Path | Role |
|-----------|------|------|
| **Node** | `apps/node` | API + dashboard — the deployment unit |
| **Access** | `apps/access` | Mobile PWA for travelers and auditors |
| **Lens** | `apps/lens` | Chrome extension (Booking.com, Expedia) |
| **SDK** | `packages/sdk` | Embed widget for travel agencies |
| **Core** | `packages/core` | Types, tiers, gossip merge logic |

End-to-end walkthroughs: [apps/README.md](apps/README.md)

---

## Quick start (local development)

```bash
git clone https://github.com/your-org/wikitraveler.git && cd wikitraveler
pnpm install && cp .env.example .env
docker compose -f docker/docker-compose.dev.yml up postgres -d
pnpm db:setup && pnpm dev
```

Open http://localhost:3000 → complete `/setup` → configure region in Admin.

| App | Command | URL |
|-----|---------|-----|
| Node | `pnpm dev` | http://localhost:3000 |
| Access | `pnpm dev:access` | http://localhost:3001 |

**Full setup** (OSM ingest, env vars, AI): [docs/LOCAL.md](docs/LOCAL.md)

---

## Deploy & release

| Topic | Doc |
|-------|-----|
| Self-hosted Docker | [docs/DOCKER.md](docs/DOCKER.md) |
| Vercel + Postgres | [docs/VERCEL.md](docs/VERCEL.md) |
| Versioning & federation policy | [docs/RELEASES.md](docs/RELEASES.md) |
| Current versions | [versions.json](versions.json) |

Operators upgrade on their own schedule; the mesh tolerates mixed node versions within policy. See [Releases](docs/RELEASES.md).

---

## Contributing

We welcome code, docs, translations, and operator experience reports.

1. Read [CONTRIBUTING.md](CONTRIBUTING.md) and [docs/COMMUNITY.md](docs/COMMUNITY.md)
2. Set up via [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)
3. Open a PR — template and checks are in `.github/`

**Security:** report vulnerabilities per [SECURITY.md](SECURITY.md), not public issues.

---

## License

MIT (source code). Mesh-contributed data: **CC-BY 4.0**.
