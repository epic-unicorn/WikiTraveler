# Release phases

Execution plan for WikiTraveler releases — from governance through community scale.

**Canonical policy:** [RELEASES.md](./RELEASES.md) · **Status:** [versions.json](../versions.json)

---

## Phase overview

| Phase | Name | Status |
|-------|------|--------|
| **0** | Governance & process | **Done** — docs hub, CONTRIBUTING, ruleset |
| **1** | Version truth | **Done** — build injection, `release.mjs`, `protocol.ts`, aligned `0.2.0` |
| **2** | CI quality gates | **Done** — `ci.yml` (lint, test, build, prisma) |
| **3** | Artifact publishing | **Done** — GHCR on tag + GitHub Release assets |
| **4** | Federation hardening | **Done** — gossip compat CI, peer version UI |
| **5** | Operator experience | Planned — doctor CLI, manifest, Admin banner |
| **6** | Community scale | Planned — npm SDK, Lens store, roadmap |

Update this table when a phase completes.

---

## Phase 0 — Governance & process ✅

**Delivered**

- [docs/README.md](./README.md) documentation hub
- [COMMUNITY.md](./COMMUNITY.md), [RELEASES.md](./RELEASES.md), [UPGRADE.md](./UPGRADE.md), [OPERATORS.md](./OPERATORS.md)
- [CONTRIBUTING.md](../CONTRIBUTING.md), [SECURITY.md](../SECURITY.md), GitHub issue/PR templates
- GitHub ruleset on `main` (PR required, no force-push)

**Maintainer actions**

- [ ] Enable Dependabot + secret scanning in GitHub Settings (if not already)
- [ ] After first CI run: add `lint`, `test`, `build`, `prisma` to ruleset status checks
- [ ] Merge docs + infra PR

---

## Phase 1 — Version truth ✅

**Delivered**

- `packages/core/src/protocol.ts` — gossip + export constants
- `WIKITRAVELER_VERSION` injected at build (Next.js + Docker)
- `scripts/release.mjs` + `scripts/lib/versions.mjs`
- `versions.json` aligned to `0.2.0`
- `/api/nodeinfo` exposes `gossipProtocol`, `minGossipProtocol`, `exportSchema`
- [COMPATIBILITY.md](./COMPATIBILITY.md)

**Maintainer actions — first release**

```bash
# After merging to main:
pnpm test && pnpm build
node scripts/release.mjs 0.2.0 --tag
git add -A && git commit -m "chore: release v0.2.0"   # if version bump commit needed
git push && git push origin v0.2.0
```

- [ ] Create GitHub Release from tag `v0.2.0` with CHANGELOG excerpt
- [ ] Set `releasedAt` in `versions.json` on the release commit

---

## Phase 2 — CI quality gates ✅

**Delivered**

- `.github/workflows/ci.yml` — jobs: `lint`, `test`, `build`, `prisma`
- CodeQL via GitHub **default setup** (Settings → Code security)
- Dependabot **alerts on**, **auto-PRs off** (no `dependabot.yml`; security updates disabled in Settings)
- `CODEOWNERS` for auth, gossip, cron, prisma

**Maintainer actions**

- [ ] Require CI jobs in ruleset (in addition to `axe`)
- [ ] Enable **Require review from Code Owners** in ruleset

---

## Phase 3 — Artifact publishing ✅

**Goal:** Operators pull images and release assets, not `main`.

**Delivered**

| Item | File |
|------|------|
| Docker publish on tag | `.github/workflows/release-docker.yml` |
| GitHub Release assets | `.github/workflows/release.yml` |
| Compose image pin | `docker/docker-compose.yml` — `WIKITRAVELER_VERSION` |
| Docs | `DOCKER.md`, `OPERATORS.md` — pull-by-tag |

**Exit criteria**

- [x] `ghcr.io/ingmarstruijs/wikitraveler-node:0.2.0` pullable (Release Docker succeeded on tag `v0.2.0`)
- [x] GitHub Release attaches Lens zip + SDK dist (`release.yml` builds core → i18n → sdk; re-run for `v0.2.0` after fix)

**Maintainer actions**

- [ ] Re-run **GitHub Release** for `v0.2.0`: Actions → GitHub Release → Run workflow → tag `v0.2.0`
- [ ] Confirm GHCR packages are **public** on first publish (Settings → Package settings)

---

## Phase 4 — Federation hardening ✅

**Goal:** Safe multi-version mesh with tested N ↔ N-1 gossip.

**Delivered**

| Item | Detail |
|------|--------|
| `protocolVersion` in `GossipDelta` | Optional field on snapshot/ingest/inbox; defaults to `1` |
| `.github/workflows/gossip-compat.yml` | Mixed-version gossip lab (node-b on `0.1.0`) |
| `NodePeer` version columns | `lastKnownVersion`, `gossipProtocol` |
| Admin peer table | Version + gossip protocol columns, skew warnings |
| [COMPATIBILITY.md](./COMPATIBILITY.md) | Updated for Phase 4 |

**Maintainer actions**

- [ ] Add `gossip-compat` job to ruleset after first workflow run

---

## Phase 5 — Operator experience

**Deliverables**

| Item | Detail |
|------|--------|
| `scripts/wikitraveler-doctor.mjs` | Version, migrations, peers, keys |
| `releases/manifest.json` | Published `latest`, `minRecommended` |
| Admin upgrade banner | Optional manifest fetch |
| Access Settings | Node + client version display |
| `docs/OPERATOR-CHECKLIST.md` | Post-deploy verification |

---

## Phase 6 — Community scale

**Deliverables**

- `@wikitraveler/sdk` on npm (on tag)
- Chrome Web Store for Lens (or signed release channel)
- `docs/ROADMAP.md` public priorities
- Monthly minor release cadence documented
- RFC template for gossip/auth/schema changes

---

## Ruleset status checks (after merge)

Add these to the **Protect main** ruleset once workflows have run once:

| Job | Workflow | Priority |
|-----|----------|----------|
| `lint` | CI | Required |
| `test` | CI | Required |
| `build` | CI | Required |
| `prisma` | CI | Required |
| `axe` | Accessibility tests | Required |
| `gossip-compat` | Gossip compat | Required (after first run) |
| Code scanning (default CodeQL) | GitHub Settings | Optional — do not add `codeql.yml` while default is on |

---

## Next step

**Add `gossip-compat` to ruleset → start Phase 5 (operator experience).**
