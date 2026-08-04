# Roadmap

Public priorities for WikiTraveler beyond the current release. Detailed phase history: [RELEASE-PHASES.md](./RELEASE-PHASES.md). Compatibility and mesh policy: [COMPATIBILITY.md](./COMPATIBILITY.md) · [RELEASES.md](./RELEASES.md).

This document is **directional**, not a commitment calendar. Items move up when operators, auditors, or travelers feel the gap.

---

## Recently completed

### Next.js 16 + React 19 (node + Access)

**Status:** Done (merged to `main`; see [CHANGELOG.md](../CHANGELOG.md)).

Both apps run **Next.js 16.2.x** and **React 19**, with App Router migration (async `params` / `searchParams` / `cookies()`, inline `force-dynamic`, ESLint CLI). High-severity transitive CVEs that Dependabot could not unlock were pinned via `pnpm.overrides` (`brace-expansion@1`, `postcss`, `js-yaml@3`, `sharp`).

**Ongoing:** Prefer coordinated app upgrades over Dependabot major bumps alone. Patch/minor Next within 16.x is welcome when CI stays green. Prefer retiring overrides by bumping parent packages when possible.

---

## Near-term: Phase 6 — community scale

**Status:** Largely delivered on `main` — see [RELEASE-PHASES.md](./RELEASE-PHASES.md#phase-6--community-scale). Remaining maintainer actions: enable npm publish secrets, Chrome Web Store upload, first public peer entries.

| Theme | Status |
|-------|--------|
| **npm SDK** | Workflow ready; enable `NPM_PUBLISH` + `NPM_TOKEN` |
| **Lens distribution** | Release zip + [LENS.md](./LENS.md) checklist; Store listing pending |
| **Release cadence** | Monthly minor documented in [RELEASES.md](./RELEASES.md) |
| **RFC template** | [docs/rfcs/](./rfcs/README.md) + GitHub issue template |
| **Peer directory** | [PUBLIC-PEERS.md](./PUBLIC-PEERS.md) (empty until operators opt in) |
| **Discovery E2E** | `pnpm gossip:discovery` in CI |
| **Gossip protocol 2** | Emit `2` / min `1` — [RFC-0001](./rfcs/0001-gossip-protocol-2.md) |

Ship tagged artifacts so operators and integrators do not clone `main`.

---

## Features

### Access as a field-ready PWA

Access is marketed as a mobile PWA, but offline today is a small `localStorage` property cache ([`apps/access/app/lib/offlineCache.ts`](../apps/access/app/lib/offlineCache.ts)) — no installable web app manifest / service worker / queued mutations.

**Direction:** Install prompt + offline shell; cache saved places and recent map results; queue community signals and (for auditors) draft audit steps when the node is unreachable; sync when back online.

### Photo storage as the default path

Object storage adapters (R2 / Supabase) and `pnpm db:migrate-photos` exist, but base64-in-Postgres remains the easy local default and will hurt backups as audits grow ([PHOTO-FACT-LINKING.md](./PHOTO-FACT-LINKING.md), [`apps/node/lib/photoStorage.ts`](../apps/node/lib/photoStorage.ts)).

**Direction:** Make external storage the recommended production path in operator docs and Admin settings; keep DB blobs only for tiny demos; improve migrate/doctor messaging when photos still live in Postgres.

### Federated photo evidence

Gossip can carry optional `photoRefs`; step-level linking landed for Access. Cross-node travelers still lose evidence when peers use different storage backends.

**Direction:** Stable, fetchable evidence URLs (or signed proxies) across the mesh; document how operators expose photo hosts to peers; extend gossip-compat coverage for photo-bearing deltas.

### Signals → audit → resolve loop

Travelers can report issues; Admins triage signals. The loop back to the reporter and into a scheduled audit is thin.

**Direction:** Clear Access status when a report is acknowledged / resolved; optional assign-to-auditor flow; link signals to properties and audit steps without cluttering the traveler UI.

### AI guesses auditors can trust

[`packages/ai-agent`](../packages/ai-agent) supports vision + gap-fill with tight limits. Operators still hit footguns (keys, photo URL modes, Ollama).

**Direction:** Better gap-fill against step photos; clearer Admin “AI scan” progress and cost controls; harden optional local/Ollama and R2 URL paths; keep `AI_GUESS` visually distinct from human tiers in Access and Lens.

### CONFIRMED-tier honesty

Promotion needs ≥3 distinct auditors (`evaluateConfirmed` in `@wikitraveler/core`). Sparse regions may never reach that bar.

**Direction:** Surface “needs corroboration” / peer-count context in Access and Lens so travelers understand trust without overclaiming; help operators recruit auditors where facts stay stuck at `VERIFIED`.

### Lens reach

Lens covers major OTAs + first-party `wt-property-id` meta. Distribution and host coverage limit traveler impact.

**Direction:** Store listing (Phase 6); expand OTA or meta adoption; keep Lens i18n in sync with [`packages/i18n`](../packages/i18n) (avoid drift from [`apps/lens/i18n.js`](../apps/lens/i18n.js)).

### SDK for agencies

UMD/ESM builds and `apps/agency-demo` exist; partners still need a published package and copy-paste integration docs.

**Direction:** Versioned npm package + CDN examples pinned to tags; locale/tier display consistent with Access; accessibility embedding checklist stays next to the widget docs ([ACCESSIBILITY.md](./ACCESSIBILITY.md)).

---

## Quality

### Close known WCAG / EAA gaps

Conformance is still **partially conformant** with known issues (Leaflet keyboard map, Access reflow, field-level errors, Lens host overlays) — see [CONFORMANCE.md](./CONFORMANCE.md).

**Direction:** Work down L-01–L-05; refresh the report version; keep `axe` + Lighthouse ≥90 required on PRs ([`.github/workflows/a11y.yml`](../.github/workflows/a11y.yml)).

### End-to-end traveler / auditor journeys

Vitest covers libs and API smoke well; there is no Playwright/Cypress CI path for full flows.

**Direction:** A few CI journeys — login → nearby → property → signal/audit → Admin triage; optional Lens popup smoke — so regressions show up before operators do.

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

### Documentation accuracy after Next 16

**Status:** Architecture / security / release docs updated for Next 16 and protocol 2.

**Direction:** Sweep version references and operator screenshots after each major stack bump so new operators trust the docs.

---

## Performance

### Map scale for regional nodes

`/api/properties/map` and Leaflet views load large pin sets; big Geofabrik / country presets will hurt Admin and Access maps.

**Direction:** Viewport or tile-aware queries; clustering; payload budgets for map endpoints; keep “audited only” filters cheap.

### Access first load on mobile

Dual Next apps + Ionic + Leaflet is a heavy traveler first paint.

**Direction:** Measure LCP/INP on Access login and property detail; trim unused client JS; preserve Lighthouse a11y while improving performance budgets.

### Cold starts and dual standalone builds

Node and Access both ship Next standalone (Docker / Vercel).

**Direction:** Track cold-start and image size for GHCR tags; avoid shipping unused AI/native deps into Access; keep monorepo build graph (`core → i18n → ui → …`) intentional rather than accidental.

### Offline-friendly caching (ties to PWA)

Field auditors often have poor connectivity.

**Direction:** Cache map tiles / property shells where policy allows; avoid unbounded IndexedDB growth; prefer resumable audit drafts over full offline writes until sync semantics are solid.

---

## How we prioritize

1. **Safety of the mesh** — security, gossip compatibility, operator upgrade clarity  
2. **Auditor effectiveness** — photos, signals loop, AI that does not invent confidence  
3. **Traveler clarity** — Access/Lens trust display, a11y, performance on phones  
4. **Adoption** — npm SDK, Lens store, discoverable peers, accurate docs  

Propose changes via PR to this file, or open an issue with the **feature request** template and link the section you care about.
