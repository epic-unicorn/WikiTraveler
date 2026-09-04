# Release phases (archive)

Historical execution ledger for WikiTraveler releases **0 → 6**. All phases are **done**.

**Canonical policy going forward:** [RELEASES.md](./RELEASES.md) · **Priorities:** [ROADMAP.md](./ROADMAP.md) · **Versions:** [versions.json](../versions.json)

---

## Phase overview

| Phase | Name | Outcome |
|-------|------|---------|
| **0** | Governance & process | Docs hub, CONTRIBUTING, Protect `main` ruleset |
| **1** | Version truth | Build injection, `release.mjs`, `protocol.ts`, `versions.json` |
| **2** | CI quality gates | `ci.yml` (lint, test, build, prisma) + Dependabot security PRs |
| **3** | Artifact publishing | GHCR on tag + GitHub Release assets |
| **4** | Federation hardening | Gossip compat CI, peer version UI, [COMPATIBILITY.md](./COMPATIBILITY.md) |
| **5** | Operator experience | `pnpm doctor`, release manifest, Admin upgrade banner |
| **6** | Community scale | RFC process, public peers, discovery E2E, protocol 2, npm/Lens paths |

Ship-facing history lives in [CHANGELOG.md](../CHANGELOG.md). Detailed phase write-ups from when this was an active plan are in git history (pre-archive commits).

---

## Remaining maintainer actions (from Phase 6)

Not blockers for `main` — enable when ready to publish externally. Same list lives under [ROADMAP.md](./ROADMAP.md#near-term-phase-6-maintainer-publish).

- [x] Set Actions variable `NPM_PUBLISH=true` for `@wikitraveler/sdk` npm publish
- [ ] Configure npm [Trusted Publishing](https://docs.npmjs.com/trusted-publishers/) on `@wikitraveler/sdk` for GitHub `ingmarstruijs/WikiTraveler` / workflow `release.yml` (allow `npm publish`). First package creation may be a one-time interactive `npm publish` before OIDC works.
- [ ] Upload Lens Release zip to the Chrome Web Store ([LENS.md](./LENS.md))
- [ ] Confirm GHCR packages are **public** for new operators
- [ ] Grow [public-peers.json](./public-peers.json) as operators opt in ([PUBLIC-PEERS.md](./PUBLIC-PEERS.md))

---

## Required status checks (Protect main)

| Job | Workflow |
|-----|----------|
| `lint`, `test`, `build`, `prisma` | CI |
| `axe` | Accessibility tests |
| `gossip-compat` | Gossip compat (N↔N-1) |
| `gossip-discovery` | Gossip compat (same-version discovery) — add after first green run if not already required |

CodeQL: use GitHub **default setup** only (do not also enable `codeql.yml`).

---

## Next

Product directions: [ROADMAP.md](./ROADMAP.md). Release process: [RELEASES.md](./RELEASES.md).
