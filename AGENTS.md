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
- Link a doc when helpful: `[PHOTO-FACT-LINKING.md](docs/PHOTO-FACT-LINKING.md)`
- Skip fluffy marketing; operators need impact

Example:

```md
### Changed

- Access audit photos attach to wizard steps / room types instead of per-fact tags ([PHOTO-FACT-LINKING.md](docs/PHOTO-FACT-LINKING.md))
```

CI enforces this for product paths on pull requests (`scripts/check-changelog.mjs`). Escape hatch: PR label `skip-changelog` (rare — explain in the PR).

## PRs

- Prefer a filled [PULL_REQUEST_TEMPLATE.md](.github/PULL_REQUEST_TEMPLATE.md)
- Check the CHANGELOG checklist item when Unreleased was updated

## Releases

Maintainers still move `[Unreleased]` → `[X.Y.Z]` at tag time per [docs/RELEASES.md](docs/RELEASES.md). Agents should not invent version bumps unless asked.
