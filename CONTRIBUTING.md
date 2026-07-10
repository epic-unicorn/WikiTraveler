# Contributing to WikiTraveler

Thank you for helping build open, federated accessibility data. This document covers the practical workflow; community context lives in [docs/COMMUNITY.md](docs/COMMUNITY.md).

---

## Before you start

1. Read the [documentation hub](docs/README.md) for your area (dev, operator, federation).
2. Check [open issues](https://github.com/ingmarstruijs/WikiTraveler/issues) — or open one to discuss large changes first.
3. Set up locally: [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).

---

## Types of contributions

| Type | Where to start |
|------|----------------|
| Bug fix | Issue + PR with repro steps |
| Feature | Issue for discussion if it touches gossip, auth, or schema |
| Documentation | `docs/` or README — follow the [docs hub](docs/README.md) structure |
| Translation | `packages/i18n/src/locales/` |
| Operator runbooks | `docs/OPERATORS.md`, `UPGRADE.md`, `DOCKER.md`, `VERCEL.md` |
| Tests | `apps/node`, `apps/access`, or package-level tests |

**Discuss before coding:**

- Breaking Prisma migrations
- Gossip delta shape changes
- Authentication or trust-tier rule changes

---

## Development workflow

```bash
git checkout main
git pull
git checkout -b feature/my-change
pnpm install
# ... edit ...
pnpm test
pnpm build
git push -u origin feature/my-change
```

Open a pull request against `main`. Use the PR template.

### Branch naming

- `feature/short-description`
- `fix/issue-123-description`
- `docs/what-you-changed`

Maintainer release branches (maintainers only): `release/v0.3.x`

---

## Code standards

- **Match existing style** — read surrounding files before editing.
- **Minimal scope** — one logical change per PR when possible.
- **No unrelated refactors** in drive-by PRs.
- **Shared logic** belongs in `packages/core` when used by node and clients.
- **Comments** only for non-obvious business logic.

### Monorepo

- Build shared packages before apps if testing manually: `pnpm build`
- Filter: `pnpm --filter @wikitraveler/node test`

---

## Required checks

| Change | Run |
|--------|-----|
| Any code | `pnpm test` · `pnpm build` |
| UI | `pnpm test:a11y` |
| Federation | `pnpm dev:gossip-lab` + `pnpm gossip:check` |
| Docs only | Verify links resolve |

CI runs accessibility workflows on PRs; keep them green.

---

## Commit messages

Use clear, complete sentences:

```
fix(gossip): tolerate missing metadataOverrides on ingest

docs: add operator upgrade runbook for Docker
```

For user-facing releases, maintainers consolidate notes in [CHANGELOG.md](CHANGELOG.md).

---

## Documentation contributions

- **Do not duplicate** — link to canonical docs from [docs/README.md](docs/README.md).
- **Audience-first** — operators vs developers vs maintainers.
- **Keep README slim** — detailed steps belong in `docs/`.
- Update cross-links when moving or renaming docs.

---

## Review process

1. Maintainer reviews for correctness, federation impact, and docs.
2. Requested changes — iterate on the same PR.
3. Merge to `main` when checks pass and scope is agreed.

Releases are tagged separately by maintainers per [docs/RELEASES.md](docs/RELEASES.md).

---

## Community standards

Follow the [Code of Conduct](CODE_OF_CONDUCT.md). Be constructive, specific, and respectful of operator sovereignty.

---

## Security

Do **not** open public issues for vulnerabilities. See [SECURITY.md](SECURITY.md).

---

## Questions

- **Dev setup** → [docs/LOCAL.md](docs/LOCAL.md)
- **Deploy** → [docs/OPERATORS.md](docs/OPERATORS.md)
- **Releases** → [docs/RELEASES.md](docs/RELEASES.md)
