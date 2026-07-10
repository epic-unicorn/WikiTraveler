# Security policy

## Supported versions

Security fixes are applied to the **latest minor release** and the **previous minor** when feasible. Upgrade guidance is published in [CHANGELOG.md](CHANGELOG.md) and [docs/UPGRADE.md](docs/UPGRADE.md).

See [versions.json](versions.json) for the current release.

## Reporting a vulnerability

**Do not open a public GitHub issue** for security vulnerabilities.

Instead:

1. Use GitHub **Private vulnerability reporting** (Security tab on the repository), if enabled, **or**
2. Email the maintainers listed on the repository with:
   - Description of the issue
   - Steps to reproduce
   - Impact assessment (especially for gossip, auth, or inbox signature bypass)
   - Affected component (node, Access, Lens, SDK)

We aim to acknowledge reports within **5 business days** and provide a remediation timeline when confirmed.

## Sensitive areas

Pay extra attention when reviewing changes touching:

| Area | Risk |
|------|------|
| `apps/node/lib/auth.ts` | JWT verification, node signatures |
| `apps/node/app/api/inbox/` | Signed gossip push acceptance |
| `apps/node/app/api/gossip/` | Federation ingest |
| `apps/node/app/api/cron/` | Unauthenticated cron if `CRON_SECRET` misconfigured |
| `POST /api/auth/*` | Account takeover, brute force |
| Admin backup/restore | Data exfiltration or destructive restore |

## Operator responsibilities

Node operators are responsible for:

- Keeping `NODE_PRIVATE_KEY`, `CRON_SECRET`, and `DATABASE_URL` secret
- Configuring `CORS_ORIGINS` appropriately (not `*` in production unless intentional)
- Applying security patches per [docs/RELEASES.md](docs/RELEASES.md)
- Rate limiting (Upstash) on public nodes — see [docs/VERCEL.md](docs/VERCEL.md)

## Disclosure

We follow coordinated disclosure: we will work with reporters on a fix before public announcement when possible, and credit reporters in the changelog unless they prefer anonymity.

## Dependency vulnerabilities (maintainers)

This repository uses **alerts + security-update PRs, without version-bump PRs**:

| GitHub setting | Location | Desired state |
|----------------|----------|---------------|
| **Dependabot alerts** | Settings → Code security and analysis | **Enabled** — vulnerabilities appear on the **Security** tab |
| **Dependabot security updates** | Same page | **Enabled** — automatic PRs for known CVEs only |
| **Dependabot version updates** | `.github/dependabot.yml` | **Off** — no scheduled bump PRs |

Review and merge security PRs promptly. For non-CVE bumps, use `pnpm update` manually, then `pnpm test` / `pnpm build`. Document security-related dependency changes in [CHANGELOG.md](CHANGELOG.md).

**Next.js 14 → 15:** Some CVEs are fixed only on Next 15.x; there is no newer 14.2 patch beyond **14.2.35**. Major-version Dependabot PRs for `next` should be **closed** (`@dependabot ignore this major version`). Planned migration: [docs/ROADMAP.md](docs/ROADMAP.md#nextjs-15-migration-node--access).
