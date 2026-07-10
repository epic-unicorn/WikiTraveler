# Changelog

All notable changes to WikiTraveler are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versioning follows [Semantic Versioning](https://semver.org/) for the monorepo release tag (`vMAJOR.MINOR.PATCH`).

**Operator notes** in each release summarize deployment actions. Full policy: [docs/RELEASES.md](docs/RELEASES.md).

---

## [Unreleased]

### Added

- Documentation hub ([docs/README.md](docs/README.md)) bundling operator, developer, community, and release guides
- [CONTRIBUTING.md](CONTRIBUTING.md), [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md), [SECURITY.md](SECURITY.md)
- [docs/RELEASES.md](docs/RELEASES.md), [docs/UPGRADE.md](docs/UPGRADE.md), [docs/OPERATORS.md](docs/OPERATORS.md), [docs/COMMUNITY.md](docs/COMMUNITY.md), [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)
- [versions.json](versions.json) canonical version manifest

### Changed

- [README.md](README.md) streamlined as community front door with links to bundled docs

---

## [0.2.0] - 2026-06-01

### Operator notes

- Node runtime reports version `0.2.0` via `/api/nodeinfo` and `/api/health`
- Gzip export uses **schema v2** (`metadataOverrides`); v1 imports remain supported
- No forced mesh upgrade required for gossip compatibility with 0.2.x peers

### Added

- Property metadata overrides with gossip and inbox sync
- WikiTraveler Access mobile audit flows
- Gossip dev lab (`pnpm dev:gossip-lab`)

[Unreleased]: https://github.com/your-org/wikitraveler/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/your-org/wikitraveler/releases/tag/v0.2.0
