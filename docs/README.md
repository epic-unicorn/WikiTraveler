# WikiTraveler documentation

Single entry point for the project. Pick the path that matches your role — each guide links to deeper docs instead of duplicating them.

---

## Choose your path

| I want to… | Start here |
|------------|------------|
| **Understand the system** | [Architecture](./ARCHITECTURE.md) |
| **Run a node in production** | [Operators guide](./OPERATORS.md) → [Docker](./DOCKER.md) or [Vercel](./VERCEL.md) |
| **Upgrade an existing deployment** | [Upgrade runbook](./UPGRADE.md) |
| **Release phases** | [Release phases](./RELEASE-PHASES.md) · [Roadmap](./ROADMAP.md) · [Compatibility](./COMPATIBILITY.md) |
| **Develop features locally** | [Development guide](./DEVELOPMENT.md) → [Local setup](./LOCAL.md) |
| **Join as a contributor** | [Community](./COMMUNITY.md) → [Contributing](../CONTRIBUTING.md) |
| **Ship or consume a release** | [Releases](./RELEASES.md) → [Changelog](../CHANGELOG.md) |
| **Test federation / gossip** | [Gossip dev lab](./GOSSIP-DEV.md) |
| **Meet accessibility requirements** | [Accessibility checklist](./ACCESSIBILITY.md) · [Conformance report](./CONFORMANCE.md) |

---

## Documentation map

### For operators (deploy & run)

| Doc | Purpose |
|-----|---------|
| [OPERATORS.md](./OPERATORS.md) | Who runs what, deployment options, first-time production checklist |
| [OPERATOR-CHECKLIST.md](./OPERATOR-CHECKLIST.md) | Post-deploy verification (`pnpm doctor`, smoke tests) |
| [DOCKER.md](./DOCKER.md) | Self-hosted node (+ optional Access) with Docker Compose |
| [VERCEL.md](./VERCEL.md) | Serverless node + Access on Vercel |
| [UPGRADE.md](./UPGRADE.md) | Version upgrades, migrations, rollback, gossip compatibility |
| [RELEASES.md](./RELEASES.md) | Versioning model, release cadence, artifacts, federation policy |
| [RELEASE-PHASES.md](./RELEASE-PHASES.md) | Phased execution plan (CI, Docker, federation) |
| [ROADMAP.md](./ROADMAP.md) | Planned work (Next 15 migration, Phase 6) |
| [COMPATIBILITY.md](./COMPATIBILITY.md) | N/N-1 mesh and protocol compatibility matrix |

### For developers (build & test)

| Doc | Purpose |
|-----|---------|
| [DEVELOPMENT.md](./DEVELOPMENT.md) | Monorepo layout, scripts, PR workflow, quality gates |
| [LOCAL.md](./LOCAL.md) | Local Postgres, apps, OSM ingest, env vars |
| [GOSSIP-DEV.md](./GOSSIP-DEV.md) | Two-node gossip lab for federation testing |
| [apps/README.md](../apps/README.md) | End-to-end flow walkthroughs (SDK, Access, Lens) |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | System design, API surface, gossip, auth |

### For the community

| Doc | Purpose |
|-----|---------|
| [COMMUNITY.md](./COMMUNITY.md) | Roles, mesh growth, communication norms |
| [../CONTRIBUTING.md](../CONTRIBUTING.md) | How to open issues and PRs |
| [../CODE_OF_CONDUCT.md](../CODE_OF_CONDUCT.md) | Expected behaviour |
| [../SECURITY.md](../SECURITY.md) | Reporting vulnerabilities |
| [../CHANGELOG.md](../CHANGELOG.md) | Release history |

### Compliance

| Doc | Purpose |
|-----|---------|
| [ACCESSIBILITY.md](./ACCESSIBILITY.md) | WCAG developer checklist |
| [PHOTO-FACT-LINKING.md](./PHOTO-FACT-LINKING.md) | Audit photo evidence (step-level) |
| [CONFORMANCE.md](./CONFORMANCE.md) | Formal accessibility conformance statement |

---

## Repository layout

```
wikitraveler/
├── apps/
│   ├── node/            # API + dashboard (deployment unit)
│   ├── access/          # Mobile PWA client
│   ├── lens/            # Chrome extension
│   └── agency-demo/     # SDK integration demo
├── packages/
│   ├── core/            # Types, tier logic, gossip merge
│   ├── sdk/             # Agency browser SDK
│   ├── ui/              # Shared React components
│   ├── i18n/            # Locales
│   └── ai-agent/        # Vision + gap-fill
├── prisma/              # Shared schema + migrations
├── docker/              # Dockerfiles + compose stacks
├── scripts/             # CLI: node:ingest, gossip:*, seed
├── docs/                # You are here
└── versions.json        # Canonical version manifest
```

---

## Quick commands

| Goal | Command |
|------|---------|
| Local node | `pnpm dev` → http://localhost:3000 |
| WikiTraveler Access | `pnpm dev:access` → http://localhost:3001 |
| Fresh local DB | `pnpm db:setup` |
| Apply migrations | `pnpm db:migrate` / `pnpm db:deploy` (production) |
| Build everything | `pnpm build` |
| Tests | `pnpm test` · `pnpm test:a11y` |
| Gossip lab | `pnpm dev:gossip-lab` |

Full script reference: [DEVELOPMENT.md](./DEVELOPMENT.md#scripts).

---

## External references

- Environment variables: [`.env.example`](../.env.example)
- Current versions: [`versions.json`](../versions.json)
- CI: [`.github/workflows/`](../.github/workflows/)
