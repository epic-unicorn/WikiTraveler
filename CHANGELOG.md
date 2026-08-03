# Changelog

All notable changes to WikiTraveler are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versioning follows [Semantic Versioning](https://semver.org/) for the monorepo release tag (`vMAJOR.MINOR.PATCH`).

**Operator notes** in each release summarize deployment actions. Full policy: [docs/RELEASES.md](docs/RELEASES.md).

---

## [Unreleased]

### Added

- Access audit photos attach to wizard steps and room types (not per-fact tags); property detail shows evidence by step ([PHOTO-FACT-LINKING.md](docs/PHOTO-FACT-LINKING.md))
- Changelog gate: PRs that touch product paths must update `CHANGELOG.md` (`scripts/check-changelog.mjs`, CI job `changelog`); agent rule in [AGENTS.md](AGENTS.md)

### Fixed

- **Security:** `pnpm.overrides` pin patched transitive deps — `glob`, `picomatch`, `tmp`, `form-data`, plus `brace-expansion@1` (1.1.18), `postcss` (8.5.25), `js-yaml@3` (≥3.15.0), `sharp` (≥0.35.0) after Dependabot could not resolve them within parent ranges
- API routes export inline `force-dynamic` so `pnpm build` does not require a running Postgres (re-exports are rejected by Next.js 16)
- `gossip-compat` retries post-sync fetches (dev servers can be briefly unavailable after cron gossip)

### Changed

- **Next.js 16 + React 19** on `apps/node` and `apps/access` (from 14.2.35): async `params`/`searchParams`/`cookies()`, ESLint CLI instead of `next lint`, stabilized `outputFileTracingIncludes` in node `next.config.js`. Closes the deferred Next security-migration item in [ROADMAP.md](docs/ROADMAP.md).
- [RELEASES.md](docs/RELEASES.md): maintainer pre-tag command sequence (`pnpm install`, `prisma generate`, test, build, tag); Unreleased kept current on each ship-facing PR
- Access: “Accessible rooms” fact renamed to “Number of accessible guest rooms” with clearer hint copy

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
