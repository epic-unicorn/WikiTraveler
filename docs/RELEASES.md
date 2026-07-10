# Releases

How WikiTraveler versions, ships, and stays compatible across a federated mesh of independently operated nodes.

**Related:** [Upgrade runbook](./UPGRADE.md) · [Changelog](../CHANGELOG.md) · [versions.json](../versions.json)

---

## Principles

| Principle | Meaning |
|-----------|---------|
| **Sovereign operators** | Each node owner chooses when to deploy. No remote force-update. |
| **Loose coupling** | Node, Access, Lens, and SDK versions are related but not lockstep. |
| **Gossip tolerance** | The mesh supports **current and previous minor** node releases unless a breaking change is announced. |
| **Migrations first** | Database schema must be migrated **before** deploying code that depends on new columns. |
| **Documented breaking windows** | Protocol or schema breaks get a sunset date in the changelog before enforcement. |

---

## Version namespaces

| Namespace | Tracks | Example | Where defined |
|-----------|--------|---------|---------------|
| **Monorepo release** | Git tag, changelog, Docker tags | `v0.3.0` | Root `package.json`, git tags |
| **Node runtime** | `/api/nodeinfo`, `/api/health`, admin UI | `0.3.0` | `apps/node/lib/nodeInfo.ts` (should match tag) |
| **Gossip protocol** | Delta JSON semantics | `1` | Documented here; optional field in future deltas |
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
| **SDK bundles** | Agencies | `packages/sdk/dist` on Release or npm |

Today: tags and changelog are manual; Docker GHCR and automated Release assets are **planned** — see [Release automation](#release-automation-roadmap).

---

## Deployment targets

| Target | Who updates | Trigger |
|--------|-------------|---------|
| **Docker node** | Operator | Pull image or rebuild from tag; restart compose |
| **Vercel node** | Operator | Deploy tag (Git integration or CLI) |
| **Docker Access** | Operator | Rebuild when `NEXT_PUBLIC_NODE_API_URL` or client changes |
| **Vercel Access** | Operator | Separate Vercel project redeploy |
| **Lens** | End user / IT | Chrome Web Store or manual unpacked update |

Details: [OPERATORS.md](./OPERATORS.md) · [UPGRADE.md](./UPGRADE.md)

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

Use this before tagging `vX.Y.Z`:

- [ ] `CHANGELOG.md` updated (Added / Changed / Fixed / Security / **Operator notes**)
- [ ] `versions.json` matches tag
- [ ] `NODE_VERSION` in node app aligned with tag (or build-injected)
- [ ] `pnpm test` and `pnpm build` pass
- [ ] `pnpm test:a11y` pass if UI changed
- [ ] Prisma migrations tested: empty DB **and** upgrade from previous tag
- [ ] `pnpm gossip:check` passes if federation code changed
- [ ] [UPGRADE.md](./UPGRADE.md) updated if operators must take special steps
- [ ] GitHub Release created with operator-facing summary

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

## Release automation roadmap

Planned CI/CD (not all implemented yet):

| Step | Workflow | Status |
|------|----------|--------|
| PR CI (lint, test, build) | `.github/workflows/ci.yml` | Planned |
| Gossip N/N-1 compat test | `.github/workflows/gossip-compat.yml` | Planned |
| Docker publish on tag | `.github/workflows/release-docker.yml` | Planned |
| GitHub Release from tag | `.github/workflows/release.yml` | Planned |
| `scripts/release.mjs` version bump helper | `scripts/` | Planned |

Contributors implementing automation should follow this doc and update the table when workflows land.

---

## Version manifest

[`versions.json`](../versions.json) is the machine-readable summary:

```json
{
  "release": "0.2.0",
  "node": "0.2.0",
  "gossipProtocol": 1,
  "exportSchema": 2,
  "minSupportedNode": "0.2.0",
  "minRecommendedNode": "0.2.0"
}
```

Future: nodes may optionally fetch a published manifest to show “upgrade available” in Admin — advisory only.
