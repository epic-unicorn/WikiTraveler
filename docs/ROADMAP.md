# Roadmap

Public priorities for WikiTraveler beyond the current release. Detailed phase history: [RELEASE-PHASES.md](./RELEASE-PHASES.md).

---

## Planned

### Next.js major upgrades (node + Access)

**Status:** Done for the 14 → 16 jump (see [CHANGELOG.md](../CHANGELOG.md) Unreleased). Prefer coordinated app upgrades over Dependabot major bumps alone.

**Current:** Next.js **16.2.x** + React **19** on `apps/node` and `apps/access`.

**Dependabot:** Close incomplete major-version Next PRs that only bump `package.json` without migration. Prefer a single PR that updates both apps, the lockfile, and App Router breaking changes together. Patch/minor Next updates within 16.x are welcome when CI stays green.

---

## Phase 6 (broader)

See [RELEASE-PHASES.md](./RELEASE-PHASES.md#phase-6--community-scale):

- `@wikitraveler/sdk` on npm
- Chrome Web Store (or signed channel) for Lens
- Monthly minor release cadence
- RFC template for gossip/auth/schema changes
