# WikiTraveler documentation

Single entry point for the project. Pick the path that matches your role — each guide links to deeper docs instead of duplicating them.

---

## Choose your path

| I want to… | Start here |
|------------|------------|
| **Understand the system** | [Architecture](./ARCHITECTURE.md) |
| **Run a node in production** | [Operators guide](./OPERATORS.md) → [Docker](./DOCKER.md) or [Vercel](./VERCEL.md) |
| **Upgrade an existing deployment** | [Upgrade runbook](./UPGRADE.md) |
| **Release archive** | [Release phases](./RELEASE-PHASES.md) · [Roadmap](./ROADMAP.md) · [Compatibility](./COMPATIBILITY.md) |
| **Develop features locally** | [Development guide](./DEVELOPMENT.md) → [Local setup](./LOCAL.md) |
| **Join as a contributor** | [Community](./COMMUNITY.md) → [Contributing](../CONTRIBUTING.md) |
| **Ship or consume a release** | [Releases](./RELEASES.md) → [Changelog](../CHANGELOG.md) |
| **Test federation / gossip** | [Gossip dev lab](./GOSSIP-DEV.md) · [Federation E2E plan](./FEDERATION-E2E.md) |
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
| [RELEASE-PHASES.md](./RELEASE-PHASES.md) | Archived phase 0–6 ledger + remaining maintainer publish todos |
| [ROADMAP.md](./ROADMAP.md) | Public priorities (maintainer publish todos, features, quality, community, strategy, performance) |
| [COMPATIBILITY.md](./COMPATIBILITY.md) | N/N-1 mesh and protocol compatibility matrix |
| [rfcs/](./rfcs/README.md) | RFC process; [RFC-0002](./rfcs/0002-global-hub-access.md) global hub Access (Accepted — M0–M5) |

### For developers (build & test)

| Doc | Purpose |
|-----|---------|
| [DEVELOPMENT.md](./DEVELOPMENT.md) | Monorepo layout, scripts, PR workflow, quality gates |
| [LOCAL.md](./LOCAL.md) | Local Postgres, apps, OSM ingest, env vars |
| [GOSSIP-DEV.md](./GOSSIP-DEV.md) | Gossip lab for federation testing (`gossip:discovery`, `gossip:hardening`, `gossip:tier-b`, `gossip:compat`) |
| [FEDERATION-E2E.md](./FEDERATION-E2E.md) | Gossip/federation E2E tiers A–D (kernel, topology, hub Access, photos) |
| [FEDERATED-AUTH.md](./FEDERATED-AUTH.md) | Register on one node; browse/audit peers with RS256 JWT |
| [RFC-0002](./rfcs/0002-global-hub-access.md) | Global hub Access/Lens, mesh CORS trust, viewport map (M0–M5 shipped; M6 follow-ons) |
| [PUBLIC-PEERS.md](./PUBLIC-PEERS.md) | Voluntary bootstrap peer directory |
| [LENS.md](./LENS.md) | Chrome extension distribution (Release zip / Store) |
| [apps/README.md](../apps/README.md) | End-to-end flow walkthroughs (SDK, Access, Lens) |
| [ACCESS-UX.md](./ACCESS-UX.md) | Access PWA IA, nav, and audit catalogue (redesign) |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | System design, API surface, gossip, auth, audit photo scopes |
| [rfcs/](./rfcs/README.md) | RFC process for gossip / auth / schema changes |

### For the community

| Doc | Purpose |
|-----|---------|
| [COMMUNITY.md](./COMMUNITY.md) | Roles, mesh growth, communication norms |
| [PUBLIC-PEERS.md](./PUBLIC-PEERS.md) | Opt-in public bootstrap peers |
| [../CONTRIBUTING.md](../CONTRIBUTING.md) | How to open issues and PRs |
| [../CODE_OF_CONDUCT.md](../CODE_OF_CONDUCT.md) | Expected behaviour |
| [../SECURITY.md](../SECURITY.md) | Reporting vulnerabilities |
| [../CHANGELOG.md](../CHANGELOG.md) | Release history |
| [packages/sdk/README.md](../packages/sdk/README.md) | Agency SDK install / embed |

### Compliance

| Doc | Purpose |
|-----|---------|
| [ACCESSIBILITY.md](./ACCESSIBILITY.md) | WCAG developer checklist |
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
| Gossip lab | `pnpm dev:gossip-lab` → `pnpm gossip:discovery` |

Full script reference: [DEVELOPMENT.md](./DEVELOPMENT.md#scripts).

---

## External references

- Environment variables: [`.env.example`](../.env.example)
- Current versions: [`versions.json`](../versions.json)
- CI: [`.github/workflows/`](../.github/workflows/)
