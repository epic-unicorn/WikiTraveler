# Changelog

All notable changes to WikiTraveler are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versioning follows [Semantic Versioning](https://semver.org/) for the monorepo release tag (`vMAJOR.MINOR.PATCH`).

**Operator notes** in each release summarize deployment actions. Full policy: [docs/RELEASES.md](docs/RELEASES.md).

---

## [Unreleased]

### Added

- Access UX redesign: Search / Saved / Profile nav, place-aware search, map “Search this area” + client cache, claim property, booking deep links, onboarding + a11y preferences, in-app report notifications ([ACCESS-UX.md](docs/ACCESS-UX.md))
- Property claim API: `POST`/`DELETE /api/properties/[id]/claim` (AUDITOR/ADMIN); `claimedByUserId` / `claimedAt` on Property + Access accessibility GET (`isClaimedByMe`) ([ACCESS-UX.md](docs/ACCESS-UX.md))
- Access audit wizard steps: Entrance → Mobility → Room → Bathroom → Communication → Review with Yes/Partial/No/N/A toggles; fields `automatic_door`, `path_to_entrance`, `corridor_min_width_cm`, `elevator_width_cm`, `visual_alarms`, `step_free_room`, `clear_space_beside_bed` ([ACCESS-UX.md](docs/ACCESS-UX.md))
- Rate limiting accepts Vercel Marketplace Upstash aliases `KV_REST_API_URL` / `KV_REST_API_TOKEN` (same as `UPSTASH_REDIS_REST_*`) ([VERCEL.md](docs/VERCEL.md))
- Access Vercel deploy: `vercel-build:access`, `apps/access/vercel.json`, and hub custom-domain steps ([VERCEL.md](docs/VERCEL.md))
- Access installable PWA: web manifest, 192/512 icons, and Apple web-app metadata for Add to Home Screen (standalone; no offline SW yet)
- Node admin property audit: full field-audit wizard (photos, room types, per-room fields), submission history, delete with safe fact rollback; admins can wipe all audit data (`@wikitraveler/audit`)

### Changed

- Node admin property audit: desktop layout polish (field rows, photo strip, danger zone, wider property page)

### Fixed

- Access favorites and accessibility preferences are stored per signed-in account (no longer shared after switching users)
- Access login crash (`THEME_CLASSES is not defined`) when resetting theme on the sign-in screen
- Access map GPS locate asks for permission, then shows a 1 km radius around the traveler
- Access “Search this area” returns after panning/zooming a search (and after clearing the query)
- Access notification popup sits above the map and lists updates immediately
- Access no longer shows “region not covered” when the home node still has data (resolve fallback / login GPS)
- Access map and property-sheet favorite hearts use the theme accent color
- Access property detail facts: field name left / value right (audit-style row), tier label + “Dit veld melden” on the line below
- Access audit: Annuleren (and successful submit) discards the session draft instead of re-saving on exit
- Access property detail title and Saved list card names use Saved/Profile hero section title typography (e.g. “Opgeslagen locaties”); audit property header and toolbar page titles (e.g. “Ter plaatse verifiëren”) match
- Access Search hero: reduced vertical padding on the search field only (logo/header unchanged)
- Access audit: removed collapsible “Huidige gegevens” panel — existing values are prefilled in the wizard fields
- Access audit wizard: auto-save draft (step, values, photos) to session storage; compact wizard nav (Terug / Annuleren left, Volgende right); manual Concept button removed
- Access audit field tier labels (e.g. Officieel) sit small under the field title instead of inline
- Access audit existing facts use the same field-row style as empty fields (prefilled pills, tier label beside field name); audit draft no longer wipes DB prefills; `path_to_entrance` pills green/yellow/red; `ui.notes` label translated; `path_to_entrance` is single-choice again
- Access audit/property display translates `path_to_entrance` enum values (step-free / uneven / steep) instead of showing English tokens
- Access Nearby distinguishes location permission denied vs GPS timeout/unavailable (no false “GPS denied”)
- Access map selection no longer re-zooms or reopens the popup after dismissing a pin and zooming out
- Access map↔list toggle keeps the Leaflet view (zoom/center) by hiding instead of unmounting the map
- Access pin popup opens again after selection (ignore popupclose during marker rebuild)
- Access map pin select keeps zoom at street/town level (≥14); only zooms in when farther out, and restores popup after viewport refresh
- Access PWA `manifest.webmanifest` / icons no longer redirect to `/login` for unauthenticated requests
- Access Search tab no longer hydrates search state from `sessionStorage` during SSR (fixes hydration mismatch)
- Access defers `IonApp` until after mount so Ionic’s `md`/`hydrated` classes no longer cause a hydration mismatch
- Access Profile: toggling accessibility preferences no longer triggers a React “setState while rendering SearchTab” error
- Access property notes: Wheelmap `[Bathroom]` / `[Communication]` dumps render as headings and bullets instead of bracket soup
- Photo migrate (`pnpm db:migrate-photos`) also rewrites `AuditPhoto` rows; R2 supports EU jurisdiction via `R2_JURISDICTION=eu` ([VERCEL.md](docs/VERCEL.md))
- Access audit wizard: Yes/Partial/No/N/A (and OSM `true`/`false`) map to canonical boolean tokens; custom room type chips stay after deselect; custom slugs such as `twin_room_disability_access` are accepted ([ACCESS-UX.md](docs/ACCESS-UX.md))
- Audit POST writes **Verified** for a field audit; **Confirmed** is only ≥3 independent auditors — unchanged OSM prefills no longer jump to Confirmed ([ARCHITECTURE.md](docs/ARCHITECTURE.md))

- Large `node:import` / Admin gzip imports no longer hit Postgres bind-variable limits or per-row upsert timeouts; imports batch with `createMany`, retry transient disconnects, and support `--limit` for smoke tests
- Vercel node builds prebuild workspace packages (`core` / `i18n` / `ui` / `ai-agent`) before Next so `@wikitraveler/i18n` resolves ([VERCEL.md](docs/VERCEL.md))
- Gossip lab `postAudit` retries Next.js HTML 404s (turbopack race) during federated hub-journey audits
- JWT login/sign normalizes PEM env keys with literal `\n` (Vercel) so RS256 no longer crashes with “Could not reach server”
- Admin dashboard map loads pins per viewport (not a one-shot `region=1` dump capped at 5000 alphabetical rows), so cities like Eindhoven show their full accommodation set when zoomed in
- Admin map search mode shows only search hits on the map and keyboard list (no mixed viewport pins)
- `PropertyCard` layout no longer squeezes titles/addresses when many audited-field badges wrap
- Admin search map pins keep audited (green) styling from VERIFIED/CONFIRMED facts
- Admin property search paginates at 100 results per page (API `page`/`pageSize`, max 100; Access keeps default 30)
- Admin search column uses a single scrollbar; list card click zooms the map; pagination notice when results exceed page size
- Access search uses the same 100/page pagination, range notice, and range count as Admin
- Admin search map keeps all result pins visible when zooming to a list selection; zooming out refits the view to the full result set

### Changed

- Access map bottom sheet property title uses the same typography as the property detail sheet
- Access theme preference is per account (Profile → Access app); login/register always use the standard theme after sign-out
- Access login hides the register link when the node has closed open registration; `/register` shows a closed message instead of the form
- Access login: removed duplicate title under the logo; sign-in block vertically centered in the viewport
- Node toolbar Signals tab shows a red badge with the count of open and in-progress community signals
- Access map property pins and GPS marker follow the active color theme (Standard / Dark / High contrast / Calm)
- Access property visit notes translate to the traveler’s selected language (DeepL when configured), with show-original toggle
- Access property photo placeholder is a simple illustration instead of a photorealistic hotel
- Access property detail hero photos swipe/scroll (keyboard arrows when focused; counter for position)
- Access GPS button shows a clear message when location is blocked or disabled (no silent fallback)
- Access Profile hero matches the larger avatar / name / outlined sign-out layout
- Access version moved out of Node connection into its own Profile section
- Access map bottom sheet shows an audited badge and a short audit summary
- Access Favorites tab (was Saved): heart icon, search/sort, richer cards; Contribute tab restored for auditors/admins; profile identity in the hero with node + Access versions; notification bell popup; named themes Standard / Dark / High contrast / Calm (automatic removed); PWA icons use bright WikiTraveler-blue with a white mark ([ACCESS-UX.md](docs/ACCESS-UX.md))
- Access UX polish: map locate (1 km Near me), property detail hero/sheet + accessibility score + claim card, minimal a11y icons, audit label/control rows + per-step notes/photos + title/address margin + scroll-to-top on step next/back; custom room type stacked input/button; add-property/audit toolbars without role chip + single back; Saved → property back returns to Saved tab; removed Check availability; Saved list cards with property photos ([ACCESS-UX.md](docs/ACCESS-UX.md))
- Access Search: shared navy Access hero (WikiTraveler · Access + Saved/Profile subsection), sticky Map/List tabs with full-height map/list, full-bleed search + filter icon, hero notification bell → Profile with badge, result meta under tabs, locate permission/progress feedback; property claim UI hidden; property sheet mini-map + a11y icons left-aligned under address; property hero photo placeholder; property facts label/value rows with single tier badge (notes left-aligned for reading); accessibility score from category coverage with help explainer; map legend removed (unified pins, saved as hearts, coverage message only — no shaded regions); zoom-in hint clears so Search this area can show; map pin opens bottom summary sheet with photo thumb; map camera restored after View property back; profile a11y preferences appear as marked chips in Advanced filters (on by default, session-off) ([ACCESS-UX.md](docs/ACCESS-UX.md))
- Access: Near me and Settings fold into Search / Profile; Favorites shows saved places only; global region chip removed from toolbar; `accessible_room_count` retired from active audit catalogue ([ACCESS-UX.md](docs/ACCESS-UX.md))
- Vercel gossip cron runs daily (`0 1 * * *`) so Hobby plan deploys work; Pro can restore a sub-daily schedule in `vercel.json` ([VERCEL.md](docs/VERCEL.md))
- Removed legacy `vercel.json` `@secret` env block — set node env vars in the Vercel project (include `CLIENT_ORIGINS`; do not ship `CORS_ORIGINS=*`) ([VERCEL.md](docs/VERCEL.md))
- Access property detail: re-audit photos merge per step/room slot (later visit overwrites a slot only if it photographed it); visit notes listed (last two open, older collapsed); thumbnails open fullscreen ([ACCESS-UX.md](docs/ACCESS-UX.md))
- Access property detail groups room facts in a labeled card per audited room type; audit wizard shows existing step photos read-only ([ACCESS-UX.md](docs/ACCESS-UX.md))

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
