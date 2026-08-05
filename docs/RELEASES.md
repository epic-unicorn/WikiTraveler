# Releases

How WikiTraveler versions, ships, and stays compatible across a federated mesh of independently operated nodes — plus **hub Access** clients that stay separate artifacts.

**Related:** [Upgrade runbook](./UPGRADE.md) · [Changelog](../CHANGELOG.md) · [versions.json](../versions.json) · [RFC-0002](./rfcs/0002-global-hub-access.md)

---

## Principles

| Principle | Meaning |
|-----------|---------|
| **Sovereign operators** | Each node owner chooses when to deploy. No remote force-update. |
| **Hub ≠ node** | Access (canonical hub or branded) is a **client artifact**; nodes hold truth. Hub outage does not stop gossip (**H4** — keep a backup Access origin allowlisted). |
| **Loose coupling** | Node, Access, Lens, and SDK versions are related but not lockstep — except when a client API contract breaks (redeploy pair; **H5**). |
| **Gossip tolerance** | The mesh supports **current and previous minor** node releases unless a breaking change is announced. |
| **Migrations first** | Database schema must be migrated **before** deploying code that depends on new columns. |
| **Documented breaking windows** | Protocol or schema breaks get a sunset date in the changelog before enforcement. |

---

## Version namespaces

| Namespace | Tracks | Example | Where defined |
|-----------|--------|---------|---------------|
| **Monorepo release** | Git tag, changelog, Docker tags | `v0.3.0` | Root `package.json`, git tags |
| **Node runtime** | `/api/nodeinfo`, `/api/health`, admin UI | `0.3.0` | `apps/node/lib/nodeInfo.ts` (should match tag) |
| **Gossip protocol** | Delta JSON semantics | `2` | `@wikitraveler/core` + [COMPATIBILITY.md](./COMPATIBILITY.md) |
| **Export schema** | Admin backup / gzip transfer | `2` | `apps/node/lib/nodeDataTransfer.ts` |
| **Access / Lens / SDK** | Client artifacts | Independent | Per-app `package.json` / `manifest.json` |

Keep [`versions.json`](../versions.json) updated on each release so operators and CI share one manifest.

---

## Release types

| Type | Tag bump | Database | Gossip | Operator action |
|------|----------|----------|--------|-----------------|
| **Patch** | `v0.3.0` → `v0.3.1` | Usually none | Unchanged | Redeploy app |
| **Minor** | `v0.3.0` → `v0.4.0` | Additive migrations | Additive fields only | `db:deploy` then redeploy |
| **Major** | `v1.0.0` → `v2.0.0` | May break | May bump protocol | Read migration guide; coordinate mesh |

---

## What gets released

Each `v*` tag should produce:

| Artifact | Audience | Distribution (target state) |
|----------|----------|----------------------------|
| **Git tag + GitHub Release** | Everyone | GitHub Releases with `CHANGELOG` excerpt |
| **Docker images** | Self-hosters | `wikitraveler-node`, `wikitraveler-access` (GHCR) |
| **Source tree** | Vercel / custom hosts | Git checkout at tag |
| **Lens zip** | Auditors | Attached to GitHub Release |
| **SDK bundles** | Agencies | `packages/sdk/dist` on Release + **npm** `@wikitraveler/sdk` when `NPM_TOKEN` + `NPM_PUBLISH` are set |
| **Release manifest** | Operators | `manifest.json` on GitHub Release + [releases/manifest.json](../releases/manifest.json) on `main` |

Tags and changelog are prepared with `scripts/release.mjs`. Docker GHCR images and GitHub Release assets publish automatically on tag push — see [Release automation](#release-automation-roadmap).

---

## Deployment targets

| Target | Who updates | Trigger |
|--------|-------------|---------|
| **Docker node** | Node operator | Pull image or rebuild from tag; restart compose |
| **Vercel node** | Node operator | Deploy tag (Git integration or CLI) |
| **Docker / Vercel Access** | Hub operator (canonical/backup) or node operator (branded) | Rebuild when `NEXT_PUBLIC_NODE_API_URL` or client changes; allowlist origin on mesh nodes |
| **Lens** | End user / IT | Chrome Web Store or manual unpacked update |

Details: [OPERATORS.md](./OPERATORS.md) · [UPGRADE.md](./UPGRADE.md)

**Do not** treat “ship Access only for my node’s travelers” as the default release narrative — prefer the hub Access + trusted CORS mesh ([OPERATORS.md](./OPERATORS.md#audiences)).

---

## Federation compatibility

### What keeps gossip working across versions

- Optional fields in gossip deltas (`metadataOverrides`, `peers`, `photoRefs`) — older nodes omit them; newer nodes tolerate absence.
- Tier/timestamp merge in `@wikitraveler/core` — deterministic, schema-driven.
- RSA node signatures + JWT verification — stable wire format.
- Cron pull every 6h — safety net if real-time inbox push fails.

### What breaks compatibility

| Change | Risk |
|--------|------|
| Required new DB column before migrate | Ingest failures on receiving node |
| Removed or renamed gossip field | Partial sync or silent data loss |
| New required auth header | 401 between peers |
| Changed merge/tier rules | Same facts resolve differently |

### Policy

1. **Additive gossip fields** for at least one minor release before making them required.
2. **Prisma migrations** additive when possible; destructive changes need [UPGRADE.md](./UPGRADE.md) backup/restore steps.
3. **Gossip protocol version** — when introduced, bump only on incompatible wire changes; document in changelog.
4. **Sunset** — after announcing `minSupportedVersion`, maintainers may stop testing older releases; operators should upgrade within the window.

### No forced mesh-wide upgrades

Stale nodes continue to sync facts they understand. “Mandatory” upgrades apply only to **security** or **data-integrity** issues, with a published deadline — not routine feature releases.

---

## Maintainer release checklist

### Keeping `[Unreleased]` current

Ship-facing PRs update `CHANGELOG.md` → `## [Unreleased]` as they land (see [CONTRIBUTING.md](../CONTRIBUTING.md) and [AGENTS.md](../AGENTS.md)). CI fails PRs that touch product paths without a changelog edit unless labeled `skip-changelog`. Tag time only moves that section into a versioned release.

### 1. Prepare the version (usually a PR)

- [ ] `CHANGELOG.md` — move `[Unreleased]` into `[X.Y.Z]` (operator notes required)
- [ ] Run `node scripts/release.mjs X.Y.Z` (bumps packages, `versions.json`, `releases/manifest.json`)
- [ ] Set `releasedAt` in `versions.json` if not set automatically
- [ ] `pnpm test` and `pnpm build` pass on the PR branch
- [ ] `pnpm test:a11y` if UI changed; `pnpm gossip:check` if federation changed
- [ ] [UPGRADE.md](./UPGRADE.md) updated if operators need special steps
- [ ] Merge to `main`

### 2. Tag from `main` (after the release commit is merged)

Run from the **repository root** (not `apps/node`). After `git pull`, refresh dependencies and the Prisma client — otherwise `pnpm build` can fail with missing ESLint or unknown fields like `lastKnownVersion`. **Postgres does not need to be running for `pnpm build`** (API routes are `force-dynamic`).

```bash
git checkout main
git pull

pnpm install
pnpm exec prisma generate

pnpm test
pnpm build

git tag -a vX.Y.Z -m "Release vX.Y.Z"
git push origin vX.Y.Z
```

Or use the helper (creates the tag locally; still push separately):

```bash
node scripts/release.mjs X.Y.Z --tag
git push origin vX.Y.Z
```

If `package.json` is already at `X.Y.Z` on `main`, skip the version-bump commit — you only need install, generate, test, build, tag, push. Skip editing `CHANGELOG.md` if `## [X.Y.Z]` is already filled in.

**Tag push triggers:** [release-docker.yml](../.github/workflows/release-docker.yml) (GHCR images) and [release.yml](../.github/workflows/release.yml) (GitHub Release: Lens zip, SDK dist, `manifest.json`).

### Pre-tag verification (checklist)

- [ ] `versions.json` and `releases/manifest.json` match the tag
- [ ] Prisma migrations tested on empty DB and upgrade from previous tag (when migrations ship)
- [ ] GitHub Release summary matches CHANGELOG operator notes (auto-generated notes are a starting point)
- [ ] GHCR packages public (first publish only)

---

## Operator consumption checklist

After a new tag ships:

1. Read the release section in [CHANGELOG.md](../CHANGELOG.md).
2. If migrations listed → `DATABASE_URL=... pnpm db:deploy` **before** app deploy.
3. Deploy node (Docker pull/restart or Vercel promote).
4. Verify `GET /api/health` shows expected version.
5. Redeploy Access if client or `NEXT_PUBLIC_NODE_API_URL` changed.
6. Optional: `pnpm gossip:check` against a known peer.

Full steps: [UPGRADE.md](./UPGRADE.md).

---

## Release cadence

Aim for a **monthly minor** (`v0.x.0`) when there is ship-facing work in `[Unreleased]`. Patches ship anytime for security or operator-blocking bugs. Skip a month rather than cutting an empty release.

| Cadence | Typical content |
|---------|-----------------|
| **Monthly minor** | Features, additive migrations, docs, federation hardening |
| **Patch as needed** | Security fixes, critical regressions |
| **Major (rare)** | Breaking gossip/auth/schema with a documented sunset |

Maintainers announce the intended minor window in the changelog or an issue when the queue is large.

---

## Release automation

| Step | Workflow | Status |
|------|----------|--------|
| PR CI (lint, test, build) | `.github/workflows/ci.yml` | **Done** |
| Gossip discovery + N/N-1 compat | `.github/workflows/gossip-compat.yml` | **Done** |
| Docker publish on tag | `.github/workflows/release-docker.yml` | **Done** |
| GitHub Release from tag | `.github/workflows/release.yml` | **Done** |
| npm `@wikitraveler/sdk` on tag | `release.yml` job `npm-publish` | **Ready** — set repo variable `NPM_PUBLISH=true` + secret `NPM_TOKEN` |
| `scripts/release.mjs` version bump helper | `scripts/release.mjs` | **Done** |
| CodeQL analysis | GitHub **default setup** (Settings → Code security) | **Done** — do not also use `codeql.yml` |
| Dependabot alerts | Settings → Code security | **Enabled** |
| Dependabot security updates | Same | **Enabled** — CVE PRs only |
| Dependabot version updates | `.github/dependabot.yml` | **Off** — no scheduled bump PRs |

See [RELEASE-PHASES.md](./RELEASE-PHASES.md) for the archived phase 0–6 ledger and remaining publish todos.

Contributors implementing automation should follow this doc and update the table when workflows land.

---

## Version manifest

[`versions.json`](../versions.json) is the machine-readable summary:

```json
{
  "release": "0.2.1",
  "node": "0.2.1",
  "gossipProtocol": 2,
  "exportSchema": 2,
  "minSupportedNode": "0.2.0",
  "minRecommendedNode": "0.2.1"
}
```

Chrome Web Store listing for Lens remains a maintainer upload after each tag ([LENS.md](./LENS.md)). Nodes optionally fetch a published manifest for upgrade advisories — see [releases/manifest.json](../releases/manifest.json) and [OPERATOR-CHECKLIST.md](./OPERATOR-CHECKLIST.md).
