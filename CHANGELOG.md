# Changelog

All notable changes to WikiTraveler are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versioning follows [Semantic Versioning](https://semver.org/) for the monorepo release tag (`vMAJOR.MINOR.PATCH`).

**Operator notes** in each release summarize deployment actions. Full policy: [docs/RELEASES.md](docs/RELEASES.md).

---

## [Unreleased]

---

## [0.2.1] - 2026-07-10

### Operator notes

- **Recommended first deploy tag** — includes Phase 5 operator tooling (`pnpm doctor`, release manifest, upgrade advisories).
- No new Prisma migrations since `0.2.0`. Redeploy app images only.
- GitHub Release attaches `manifest.json` alongside Lens zip and SDK dist.
- Docker: `ghcr.io/ingmarstruijs/wikitraveler-node:0.2.1`, `wikitraveler-access:0.2.1`.

### Added

- Phase 5 operator experience: `pnpm doctor`, `releases/manifest.json`, Admin upgrade banner, Access Settings version display, [OPERATOR-CHECKLIST.md](docs/OPERATOR-CHECKLIST.md)
- `@wikitraveler/core` semver helpers and upgrade assessment for node/Access advisories

### Changed

- Dependabot: security-update PRs enabled; version-bump PRs remain off (documented in [SECURITY.md](SECURITY.md))
- Lighthouse CI uses runner Chrome instead of downloading Chrome each run (faster `a11y` workflow)
- [RELEASES.md](docs/RELEASES.md) reflects completed release automation (GHCR, GitHub Release, manifest)

### Fixed

- GitHub Release workflow: build `@wikitraveler/i18n` before SDK
- `release.yml` supports manual re-run via **workflow_dispatch** for an existing tag

---

## [0.2.0] - 2026-07-10

### Operator notes

- **Next.js 14.2.35** on node and access (security patch). Run `pnpm db:deploy` before deploy when upgrading.
- Node reports `0.2.0` via `/api/health` and `/api/nodeinfo` (`gossipProtocol: 1`, `exportSchema: 2`).
- Docker images published on tag: `ghcr.io/ingmarstruijs/wikitraveler-node:0.2.0`, `wikitraveler-access:0.2.0`.
- Gzip export uses **schema v2**; v1 imports still work. No forced mesh upgrade for 0.2.x peers.

### Added

- Documentation hub ([docs/README.md](docs/README.md)), [COMMUNITY.md](docs/COMMUNITY.md), [OPERATORS.md](docs/OPERATORS.md), [RELEASES.md](docs/RELEASES.md), [UPGRADE.md](docs/UPGRADE.md), [DEVELOPMENT.md](docs/DEVELOPMENT.md), [RELEASE-PHASES.md](docs/RELEASE-PHASES.md), [COMPATIBILITY.md](docs/COMPATIBILITY.md)
- [CONTRIBUTING.md](CONTRIBUTING.md), [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md), [SECURITY.md](SECURITY.md), [versions.json](versions.json)
- CI (`.github/workflows/ci.yml`): lint, test, build, prisma
- Release automation: `.github/workflows/release-docker.yml`, `.github/workflows/release.yml`
- `scripts/release.mjs`, `packages/core/src/protocol.ts`, `/api/nodeinfo` protocol fields
- Property metadata overrides with gossip and inbox sync
- WikiTraveler Access mobile audit flows
- Gossip dev lab (`pnpm dev:gossip-lab`)

### Changed

- [README.md](README.md) streamlined as community front door
- All workspace packages aligned to version `0.2.0`
- CodeQL via GitHub default setup (no custom `codeql.yml`)

[Unreleased]: https://github.com/ingmarstruijs/WikiTraveler/compare/v0.2.1...HEAD
[0.2.1]: https://github.com/ingmarstruijs/WikiTraveler/releases/tag/v0.2.1
[0.2.0]: https://github.com/ingmarstruijs/WikiTraveler/releases/tag/v0.2.0
