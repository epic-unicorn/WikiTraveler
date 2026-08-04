# Agent instructions (WikiTraveler)

Guidance for Cursor / coding agents working in this repository.

## Changelog (required for user-visible work)

When a change is **user-visible** or **operator-visible**, **always** add a bullet under `CHANGELOG.md` → `## [Unreleased]` in the same PR/commit series — do not leave it for tag time.

User / operator visible includes:
- Access or Lens UX
- Node Admin UI
- API behaviour auditors, travelers, or operators notice
- i18n copy travelers/auditors see
- Migrations, deploy steps, Docker, or gossip/protocol behaviour

Not required (docs/tests/chore alone):
- Docs-only, test-only, CI-only, or internal refactors with no ship-facing effect
- Pure dependency bumps with no behaviour change (unless security — then note under Fixed)

### How to write the bullet

- Keep a Changelog style: short, past tense or noun phrase, specific
- Prefer `### Added` / `### Changed` / `### Fixed` / `### Removed`
- Link a doc when helpful: `[ARCHITECTURE.md](docs/ARCHITECTURE.md)` (or the role-specific guide from [docs/README.md](docs/README.md))
- Skip fluffy marketing; operators need impact

Example:

```md
### Changed

- Access audit photos attach to wizard steps / room types instead of per-fact tags ([ARCHITECTURE.md](docs/ARCHITECTURE.md))
```

CI enforces this for product paths on pull requests (`scripts/check-changelog.mjs`). Escape hatch: PR label `skip-changelog` (rare — explain in the PR).

## PRs

- Prefer a filled [PULL_REQUEST_TEMPLATE.md](.github/PULL_REQUEST_TEMPLATE.md)
- Check the CHANGELOG checklist item when Unreleased was updated

## Releases

Maintainers still move `[Unreleased]` → `[X.Y.Z]` at tag time per [docs/RELEASES.md](docs/RELEASES.md). Agents should not invent version bumps unless asked.

## Cursor Cloud specific instructions

Startup notes for cloud agents (the update script only runs `pnpm install`, which also runs `prisma generate` via `postinstall`). Standard dev commands live in [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) and [docs/LOCAL.md](docs/LOCAL.md); only the non-obvious cloud caveats are below.

- **Postgres runs natively here, not via Docker.** Docker is not installed in this VM; PostgreSQL 16 is installed on the host instead. The docs' `docker compose ... up postgres` step is replaced by starting the local cluster: `sudo pg_ctlcluster 16 main start` (run once per boot; it does not auto-start). The `wikitraveler` role + `wikitraveler` DB already exist and match the default `DATABASE_URL` in `.env.example`.
- **`.env` is required** and works unchanged from `.env.example`: `cp .env.example .env`. All external integrations (AI, Redis rate limiting, R2/Supabase photos) are optional and safely skipped when unset.
- **DB init:** after Postgres is up, `pnpm db:setup` does a destructive reset + migrate + seed (35 sample Eindhoven properties, 22 field definitions). Use `pnpm db:migrate` instead to preserve data.
- **Run the apps:** `pnpm dev` → Node dashboard/API at http://localhost:3000; `pnpm dev:access` → Access PWA at http://localhost:3001. On first visit the Node app redirects to `/setup` to create the first admin account before the dashboard loads.
- **lint/test/build** are the standard root scripts (`pnpm lint`, `pnpm test`, `pnpm build`) and need no DB. Only runtime/dev servers and `pnpm db:*` require Postgres running.
