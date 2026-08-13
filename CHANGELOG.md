# Changelog

All notable changes to WikiTraveler are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versioning follows [Semantic Versioning](https://semver.org/) for the monorepo release tag (`vMAJOR.MINOR.PATCH`).

**Operator notes** in each release summarize deployment actions. Full policy: [docs/RELEASES.md](docs/RELEASES.md).

---

## [Unreleased]

### Fixed

- Large `node:import` / Admin gzip imports no longer hit Postgres bind-variable limits or per-row upsert timeouts; imports batch with `createMany`, retry transient disconnects, and support `--limit` for smoke tests
- Vercel node builds prebuild workspace packages (`core` / `i18n` / `ui` / `ai-agent`) before Next so `@wikitraveler/i18n` resolves ([VERCEL.md](docs/VERCEL.md))
- Gossip lab `postAudit` retries Next.js HTML 404s (turbopack race) during federated hub-journey audits
- JWT login/sign normalizes PEM env keys with literal `\n` (Vercel) so RS256 no longer crashes with “Could not reach server”
- Admin dashboard map loads pins per viewport (not a one-shot `region=1` dump capped at 5000 alphabetical rows), so cities like Eindhoven show their full accommodation set when zoomed in
- Admin map search mode shows only search hits on the map and keyboard list (no mixed viewport pins)
- `PropertyCard` layout no longer squeezes titles/addresses when many audited-field badges wrap
- Admin search map pins keep audited (green) styling from VERIFIED/CONFIRMED facts
- Admin property search paginates at 100 results per page (API `page`/`pageSize`, max 100; Access keeps default 30)

### Changed

- Vercel gossip cron runs daily (`0 1 * * *`) so Hobby plan deploys work; Pro can restore a sub-daily schedule in `vercel.json` ([VERCEL.md](docs/VERCEL.md))
- Removed legacy `vercel.json` `@secret` env block — set node env vars in the Vercel project (include `CLIENT_ORIGINS`; do not ship `CORS_ORIGINS=*`) ([VERCEL.md](docs/VERCEL.md))

---

## [0.4.0] - 2026-08-08

### Operator notes

- **Recommended first deploy tag** — RFC-0002 hub Access architecture (M1–M5): trusted CORS, home vs data-node routing, viewport map, Lens background fetch, hub operator docs. Prefer this over `0.3.0` for new nodes and Access.
- No new Prisma migrations since `0.3.0`. Redeploy app images (or rebuild from tag) only.
- **Node + Access pair (H5):** redeploy both — map API now requires `bbox=` (or Admin `region=1`); unscoped map dumps are rejected.
- Set trusted client origins on every public data node: `CORS_ORIGINS` and/or `CLIENT_ORIGINS` (and optional `ACCESS_PUBLIC_URL`) for your hub Access origin(s). Do **not** leave `CORS_ORIGINS=*` in production; gossip `accessUrl` is not auto-trusted ([RFC-0002](docs/rfcs/0002-global-hub-access.md)).
- Node reports `gossipProtocol: 2` (min supported still `1`); mesh with `0.3.x` / `0.2.x` peers remains supported.
- Docker: `ghcr.io/ingmarstruijs/wikitraveler-node:0.4.0`, `wikitraveler-access:0.4.0`.
- GitHub Release attaches `manifest.json`, Lens zip, and SDK dist. npm `@wikitraveler/sdk` publishes only when `NPM_PUBLISH` + `NPM_TOKEN` are set.
- M6 follow-ons (viewport fan-out, shorter JWT TTL, Admin peer-origin UI, etc.) remain later — not required for this deploy.

### Added

- Federation Tier A–C E2E in CI: mesh hardening, mesh-3 topology (CONFIRMED, resolve), hub journey / `photoRefs` / Lens Origin (`pnpm gossip:hardening`, `gossip:tier-b`, `gossip:tier-c`) ([FEDERATION-E2E.md](docs/FEDERATION-E2E.md))
- Gossip lab rewrites host-mapped `localhost:3000/3010/3020` peer URLs to docker DNS for federated JWT pubkey fetch, inbox upsert, and peer ingest (`GOSSIP_DEV`)
- Global region preset catalog (all continents): Admin/CLI presets for major cities plus Geofabrik extracts across Europe, North/South America, Asia, Africa, and Oceania; UI groups as `{tier} · {continent}` ([LOCAL.md](docs/LOCAL.md#region-presets-global-catalog), [ARCHITECTURE.md](docs/ARCHITECTURE.md))
- Trusted browser CORS for `/api/*`: reflect `Origin` when it matches `CORS_ORIGINS` ∪ `CLIENT_ORIGINS` ∪ `ACCESS_PUBLIC_URL` (`proxy.ts`); OPTIONS preflight; `Vary: Origin`. Gossip `accessUrl` is not auto-trusted ([RFC-0002](docs/rfcs/0002-global-hub-access.md))
- `GET /api/nodeinfo` may include `accessUrl` and `clientOrigins` for hub/directory advertisement
- Access treats **home node** as identity and **data node** (GPS resolve) for search/browse/nearby; uncovered locations show “This area isn’t covered yet” instead of dumping home-node map pins ([RFC-0002](docs/rfcs/0002-global-hub-access.md) M2)
- Peer resolve picks the **smallest containing** peer bbox (then nearest center) when multiple peers overlap
- Viewport map API: `GET /api/properties/map` requires `bbox=` (or Admin `region=1`); oversized viewports return `BBOX_TOO_LARGE`; Access shows coverage at low zoom and loads pins per viewport ([RFC-0002](docs/rfcs/0002-global-hub-access.md) M3)
- Lens proxies Node API calls through the extension service worker (`NODE_FETCH`); optional HTTPS host permissions for production mesh peers; coverage copy “No WikiTraveler coverage here.” ([RFC-0002](docs/rfcs/0002-global-hub-access.md) M4)

### Changed

- Region preset Geofabrik catalog uses continent-aware download paths (not Europe-only); Canada marked offline-only due to extract size
- Node no longer sets a static comma-joined `Access-Control-Allow-Origin` in `next.config.js` (invalid for multi-origin lists); use env allowlists above
- Access browse map loads pins from the resolved **data** node, not always the home node
- Nearby queries prefilter by a rough lat/lon window before haversine
- Admin dashboard map uses `?region=1` (node configured bbox) instead of an unscoped pin dump
- Operator / release docs distinguish **hub Access** vs **node** mesh; backup Access dual-origin allowlisting (**H4**); Access↔node map redeploy pair (**H5**) ([OPERATORS.md](docs/OPERATORS.md), [RELEASES.md](docs/RELEASES.md), [RFC-0002](docs/rfcs/0002-global-hub-access.md) M5)
- Lens options copy: home node = identity; routes to regional data nodes when covered
- Renamed Next.js `middleware.ts` → `proxy.ts` (Node + Access) for the Next.js 16 file convention

### Fixed

- Docker entrypoints strip CRLF after COPY; `.gitattributes` forces LF on `*.sh` so Windows checkouts do not fail with `exec /entrypoint.dev.sh: no such file or directory`
- Pin transitive `js-yaml@4` to `>=4.3.1` via `pnpm.overrides` (Dependabot could not unlock past 4.3.0)
- Gossip ingest still exchanges `peers[]` when no region bbox is configured (fact/override ingest stays skipped) — unblocks transitive discovery before region setup ([FEDERATION-E2E.md](docs/FEDERATION-E2E.md))

---

## [0.3.0] - 2026-08-04

### Operator notes

- Superseded for new deploys by **`0.4.0`** (hub Access architecture). Still valid for Next.js 16 + React 19, Phase 6 federation scaffolding, security pins, Access step-level photo evidence.
- No new Prisma migrations since `0.2.1`. Redeploy app images (or rebuild from tag) only.
- Node reports `gossipProtocol: 2` (min supported still `1`); mesh with `0.2.x` peers remains supported.
- Redeploy **Access** with this tag so client and node versions align; rebuild if `NEXT_PUBLIC_NODE_API_URL` changed.
- Docker: `ghcr.io/ingmarstruijs/wikitraveler-node:0.3.0`, `wikitraveler-access:0.3.0`.
- GitHub Release attaches `manifest.json`, Lens zip, and SDK dist. npm `@wikitraveler/sdk` publishes only when `NPM_PUBLISH` + `NPM_TOKEN` are set.

### Added

- Phase 6 community scale: RFC process ([docs/rfcs/](docs/rfcs/README.md)), voluntary [public peers directory](docs/PUBLIC-PEERS.md), [federated auth](docs/FEDERATED-AUTH.md) guide, [Lens distribution](docs/LENS.md) checklist, monthly release cadence in [RELEASES.md](docs/RELEASES.md)
- `pnpm gossip:discovery` end-to-end multi-node bootstrap discovery + gossip sync (CI job alongside N↔N-1 compat)
- npm publish path for `@wikitraveler/sdk` on tag (`NPM_PUBLISH` + `NPM_TOKEN`) — package bundles `@wikitraveler/core` / `@wikitraveler/i18n`
- Access audit photos attach to wizard steps and room types (not per-fact tags); property detail shows evidence by step ([ARCHITECTURE.md](docs/ARCHITECTURE.md#audit-photo-evidence-step-level))
- Changelog gate: PRs that touch product paths must update `CHANGELOG.md` (`scripts/check-changelog.mjs`, CI job `changelog`); agent rule in [AGENTS.md](AGENTS.md)
- Docker node + Access compose stack (`pnpm docker:stack`)

### Fixed

- Gossip ingest applies peer exchange even when a delta has no in-bbox facts (organic discovery no longer depends on regional audits)
- **Security:** `pnpm.overrides` pin patched transitive deps — `glob`, `picomatch`, `tmp`, `form-data`, plus `brace-expansion@1` (1.1.18), `brace-expansion@5` (≥5.0.9), `postcss` (8.5.25), `js-yaml@3` (≥3.15.0), `sharp` (≥0.35.0), `ip-address` (≥10.3.1), `uuid` (≥11.1.1), `cookie` (≥0.7.0)
- **Security:** Agency demo and Access harden node URLs (http/https only) and same-origin `next` redirects; clears CodeQL XSS / open-redirect findings
- **Security:** CI and Accessibility workflows set explicit `permissions: contents: read` (CodeQL `actions/missing-workflow-permissions`)
- API routes export inline `force-dynamic` so `pnpm build` does not require a running Postgres (re-exports are rejected by Next.js 16)
- `gossip-compat` retries post-sync fetches (dev servers can be briefly unavailable after cron gossip)

### Changed

- Gossip protocol emit **`2`** (min supported still `1`) with optional `peers[].gossipProtocol` / `peers[].version` — [RFC-0001](docs/rfcs/0001-gossip-protocol-2.md) · [COMPATIBILITY.md](docs/COMPATIBILITY.md)
- **Next.js 16 + React 19** on `apps/node` and `apps/access` (from 14.2.35): async `params`/`searchParams`/`cookies()`, ESLint CLI instead of `next lint`, stabilized `outputFileTracingIncludes` in node `next.config.js`
- [RELEASES.md](docs/RELEASES.md): maintainer pre-tag command sequence (`pnpm install`, `prisma generate`, test, build, tag); Unreleased kept current on each ship-facing PR
- Access: “Accessible rooms” fact renamed to “Number of accessible guest rooms” with clearer hint copy

---

## [0.2.1] - 2026-07-10

### Operator notes

- Includes Phase 5 operator tooling (`pnpm doctor`, release manifest, upgrade advisories). Prefer **`0.4.0`** for new deploys.
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

[Unreleased]: https://github.com/ingmarstruijs/WikiTraveler/compare/v0.4.0...HEAD
[0.4.0]: https://github.com/ingmarstruijs/WikiTraveler/releases/tag/v0.4.0
[0.3.0]: https://github.com/ingmarstruijs/WikiTraveler/releases/tag/v0.3.0
[0.2.1]: https://github.com/ingmarstruijs/WikiTraveler/releases/tag/v0.2.1
[0.2.0]: https://github.com/ingmarstruijs/WikiTraveler/releases/tag/v0.2.0
