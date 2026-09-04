# Roadmap

Public priorities for WikiTraveler beyond the current release. Completed phase ledger: [RELEASE-PHASES.md](./RELEASE-PHASES.md). Compatibility and mesh policy: [COMPATIBILITY.md](./COMPATIBILITY.md) · [RELEASES.md](./RELEASES.md).

This document is **directional**, not a commitment calendar. Items move up when operators, auditors, or travelers feel the gap.

---

## Recently completed

| Theme | Notes |
|-------|--------|
| **Next.js 16 + React 19** | Node + Access; App Router migration; CVE overrides where Dependabot could not unlock parents ([CHANGELOG.md](../CHANGELOG.md)) |
| **RFC-0002 M0–M5** | Global hub Access & Lens; trusted CORS; viewport map; tracking [#51](https://github.com/ingmarstruijs/WikiTraveler/issues/51) closed |
| **Access UX + installable PWA** | Search / Favorites / Contribute / Profile; audit catalogue; web manifest + icons (no offline SW yet) — [ACCESS-UX.md](./ACCESS-UX.md) |
| **Node admin audit parity** | Full field-audit wizard on the property page; wipe / history / safe rollback |
| **Lens UX + client cache** | Score / features / onboarding; default `node-eu`; TTL + in-flight dedupe; View details / Report → Access — [LENS.md](./LENS.md) |
| **Admin signal cleanup** | Hard-delete one signal; bulk-clear RESOLVED/DISMISSED |
| **Phase 6 on `main`** | RFC process, public peers path, gossip discovery + Tier A–C E2E, protocol 2 — maintainer publish todos remain in [RELEASE-PHASES.md](./RELEASE-PHASES.md) |

**Ongoing stack hygiene:** Prefer coordinated app upgrades over Dependabot majors alone. Patch/minor Next within 16.x when CI stays green. Retire `pnpm.overrides` by bumping parents when possible.

---

## Near-term: Phase 6 maintainer publish

**Status:** Code delivered on `main` — see [RELEASE-PHASES.md](./RELEASE-PHASES.md). Remaining actions (not blockers for `main`):

| Theme | Status |
|-------|--------|
| **npm SDK** | `NPM_PUBLISH=true`; Trusted Publishing on `@wikitraveler/sdk` for `release.yml` |
| **Lens distribution** | Release zip + [LENS.md](./LENS.md) checklist; Store listing pending |
| **Peer directory** | [PUBLIC-PEERS.md](./PUBLIC-PEERS.md) (empty until operators opt in) |
| **GHCR visibility** | Confirm packages stay public for new operators |

Ship tagged artifacts so operators and integrators do not clone `main`.

---

## Features

### Global hub Access & Lens (federation invisible)

**Status:** Accepted — **M0–M5 shipped** ([RFC-0002](./rfcs/0002-global-hub-access.md); PRs [#50](https://github.com/ingmarstruijs/WikiTraveler/pull/50)–[#55](https://github.com/ingmarstruijs/WikiTraveler/pull/55); [#51](https://github.com/ingmarstruijs/WikiTraveler/issues/51) closed).

Travelers use one Access (canonical hub e.g. `access.wikitraveler.org`) and Lens worldwide: home node = identity, regional nodes = data, mesh CORS for **trusted** hub origins only. Map is coverage + viewport pins — not home-node inventory.

**Direction:** **M6** follow-ons (multi-node viewport fan-out, Admin peer client-origin UI, shorter JWT TTL, etc.). Keep rejecting home-node audit proxy and default regional Access redirect as the primary path.

### Access offline / field resilience

**Status:** Installable PWA (manifest + icons) shipped; property detail still uses a small `localStorage` cache ([`offlineCache.ts`](../apps/access/app/lib/offlineCache.ts)). No service worker, offline shell, or queued mutations.

**Direction:** Offline shell; cache saved places and recent map results; queue community signals and (for auditors) draft audit steps when the node is unreachable; sync when back online.

### Photo storage as the default path

Object storage adapters (R2 / Supabase) and `pnpm db:migrate-photos` exist, but base64-in-Postgres remains the easy local default and will hurt backups as audits grow ([LOCAL.md](./LOCAL.md), [`apps/node/lib/photoStorage.ts`](../apps/node/lib/photoStorage.ts)).

**Direction:** Make external storage the recommended production path in operator docs and Admin settings; keep DB blobs only for tiny demos; improve migrate/doctor messaging when photos still live in Postgres.

### Federated photo evidence

Gossip can carry optional `photoRefs`; step-level linking landed for Access. Cross-node travelers still lose evidence when peers use different storage backends.

**Direction:** Stable, fetchable evidence URLs (or signed proxies) across the mesh; document how operators expose photo hosts to peers; extend gossip-compat coverage for photo-bearing deltas.

### Signals → audit → resolve loop

**Status:** Travelers report; Access notifications surface resolved/dismissed; Admins triage, hard-delete, and bulk-clear closed signals. The loop back into a scheduled audit / assign-to-auditor flow is still thin.

**Direction:** Clearer Access status when a report is acknowledged; optional assign-to-auditor; link signals to properties and audit steps without cluttering the traveler UI.

### AI guesses auditors can trust

[`packages/ai-agent`](../packages/ai-agent) supports vision + gap-fill with tight limits. Operators still hit footguns (keys, photo URL modes, Ollama).

**Direction:** Better gap-fill against step photos; clearer Admin “AI scan” progress and cost controls; harden optional local/Ollama and R2 URL paths; keep `AI_GUESS` visually distinct from human tiers in Access and Lens.

### CONFIRMED-tier honesty

Promotion needs ≥3 distinct auditors (`evaluateConfirmed` in `@wikitraveler/core`). Sparse regions may never reach that bar.

**Direction:** Surface “needs corroboration” / peer-count context in Access and Lens so travelers understand trust without overclaiming; help operators recruit auditors where facts stay stuck at `VERIFIED`.

### Lens reach

**Status:** Major OTAs + `wt-property-id` meta; UX refresh, default EU home node, client TTL cache, and unit tests shipped ([LENS.md](./LENS.md)). Distribution and host coverage still limit traveler impact.

**Direction:** Chrome Web Store listing (Phase 6 maintainer todo); expand OTA or meta adoption; keep Lens i18n regenerated from [`packages/i18n`](../packages/i18n).

### SDK for agencies

UMD/ESM builds and `apps/agency-demo` exist; partners still need a published package and copy-paste integration docs.

**Direction:** Versioned npm package + CDN examples pinned to tags; locale/tier display consistent with Access; accessibility embedding checklist stays next to the widget docs ([ACCESSIBILITY.md](./ACCESSIBILITY.md)).

---

## Quality

### Close known WCAG / EAA gaps

Conformance is still **partially conformant** with known issues (Leaflet keyboard map, Access reflow, field-level errors, Lens host overlays) — see [CONFORMANCE.md](./CONFORMANCE.md).

**Direction:** Work down L-01–L-05; refresh the report version; keep `axe` + Lighthouse ≥90 required on PRs ([`.github/workflows/a11y.yml`](../.github/workflows/a11y.yml)).

### End-to-end traveler / auditor journeys

Vitest covers libs and API smoke well; gossip lab CI covers mesh discovery, Tier A hardening, Tier B topology, and Tier C client-federation API suites ([FEDERATION-E2E.md](./FEDERATION-E2E.md)). Full Access/Lens Playwright UI is still optional.

**Direction:** Optional Access Playwright UI on top of Tier C API coverage; Tier D feature gates as M6 items land ([FEDERATION-E2E.md](./FEDERATION-E2E.md)).

### Dependency security without override debt

Overrides clear CVEs when Dependabot cannot unlock parent ranges; they are not a forever strategy.

**Direction:** Prefer parent bumps (Next, eslint stack, tsup, `@lhci/cli`) that retire overrides; keep Dependabot **security** updates on and version-bump spam off; revisit remaining lower-priority alerts (`uuid`, `cookie`, `esbuild`) deliberately.

### Gossip protocol evolution

**Status:** Protocol emit **`2`**, min supported **`1`** ([RFC-0001](./rfcs/0001-gossip-protocol-2.md)). Peer exchange carries optional version hints; ingest applies peers even without in-bbox facts.

**Direction:** Further breaks go through the [RFC process](./rfcs/README.md); keep [gossip-compat](../.github/workflows/gossip-compat.yml) green for discovery + N↔N-1; raise `minGossipProtocol` only with CHANGELOG sunset notes.

---

## Community

### Artifact-first adoption

Operators should pull GHCR tags and Release assets, not clone `main` ([OPERATORS.md](./OPERATORS.md), [DOCKER.md](./DOCKER.md)).

**Direction:** Finish Phase 6 packaging; keep `releases/manifest.json` and Admin upgrade banners accurate; confirm GHCR packages stay public for new operators.

### Federation discoverability

**Status:** Voluntary [public-peers.json](./public-peers.json) + bootstrap + gossip peer exchange (including protocol/version hints).

**Direction:** Grow the directory as operators opt in; keep first-run bootstrap guidance current so Access GPS resolve has somewhere to start.

### Contribution ladders

**Status:** Labels documented in [CONTRIBUTING.md](../CONTRIBUTING.md); RFC template for federation-impacting work.

**Direction:** Tag issues `good first issue` / `help wanted` in practice; translator checklist for new locales (beyond en/nl/de/fr); operator help remains the path for non-code participation ([COMMUNITY.md](./COMMUNITY.md)).

### Lightweight community space

Docs mention Matrix/Discord “when established.”

**Direction:** One linked channel for operators + contributors when traffic justifies it; keep governance maintainer-led until the mesh needs more process.

---

## Strategy

### Operator sovereignty with a shared baseline

N / N-1 mesh support is a deliberate product choice ([RELEASES.md](./RELEASES.md)).

**Direction:** Security-critical upgrades stay loud (banner + CHANGELOG + SECURITY); non-breaking minors stay easy; never force same-day upgrades for cosmetic changes.

### Regional node growth

OSM ingest is powerful but CLI-first and Vercel-hostile.

**Direction:** Clearer “export elsewhere → import here” stories; Admin import progress; curated region presets that match real operator capacity (pin count, disk, cron).

### Trust layer positioning

WikiTraveler is a federated **truth layer**, not a booking engine.

**Direction:** Keep SDK/Lens read-first for travelers; deepen auditor tools without turning Access into an ops console; measure success by corroborated facts and regional coverage, not pageviews alone.

### Documentation accuracy after major stack bumps

**Status:** Architecture / security / release docs updated for Next 16 and protocol 2; feature notes like photo evidence folded into [ARCHITECTURE.md](./ARCHITECTURE.md).

**Direction:** Sweep version references and operator screenshots after each major stack bump so new operators trust the docs. Prefer folding one-off feature notes into ARCHITECTURE / OPERATORS rather than new top-level docs.

---

## Performance

### Map scale for regional nodes

`/api/properties/map` and Leaflet views load large pin sets; big Geofabrik / country presets will hurt Admin and Access maps.

**Direction:** Viewport or tile-aware queries; clustering; payload budgets for map endpoints; keep “audited only” filters cheap. Global Access browse must not dump home-node pins — see [RFC-0002](./rfcs/0002-global-hub-access.md) Phase 3.

### Access first load on mobile

Dual Next apps + Ionic + Leaflet is a heavy traveler first paint.

**Direction:** Measure LCP/INP on Access login and property detail; trim unused client JS; preserve Lighthouse a11y while improving performance budgets.

### Cold starts and dual standalone builds

Node and Access both ship Next standalone (Docker / Vercel).

**Direction:** Track cold-start and image size for GHCR tags; avoid shipping unused AI/native deps into Access; keep monorepo build graph (`core → i18n → ui → …`) intentional rather than accidental.

### Offline-friendly caching (ties to Access offline)

**Status:** Lens popup/listing TTL cache shipped ([`lensCache.js`](../apps/lens/lensCache.js)); Access still relies on a small property-detail cache — no SW / tile cache / mutation queue.

**Direction:** Cache map tiles / property shells where policy allows; avoid unbounded IndexedDB growth; prefer resumable audit drafts over full offline writes until sync semantics are solid.

---

## How we prioritize

1. **Safety of the mesh** — security, gossip compatibility, operator upgrade clarity  
2. **Auditor effectiveness** — photos, signals loop, AI that does not invent confidence  
3. **Traveler clarity** — Access/Lens trust display, a11y, performance on phones  
4. **Adoption** — npm SDK, Lens store, discoverable peers, accurate docs  

Propose changes via PR to this file, or open an issue with the **feature request** template and link the section you care about.
