# Roadmap

Public priorities for WikiTraveler beyond the current release. Detailed phase history: [RELEASE-PHASES.md](./RELEASE-PHASES.md).

---

## Planned

### Next.js 15 migration (node + Access)

**Status:** Deferred — tracked intentionally, not forgotten.

**Current:** Next.js **14.2.35** on `apps/node` and `apps/access` (latest 14.2.x patch).

**Target:** Next.js **15.x** (e.g. 15.5 LTS line) in both apps together, with lockfile and CI green.

**Why not now:** Next 15 is a **major** upgrade. Dependabot security PRs that jump 14 → 15 (e.g. PR #29) fail CI without a dedicated migration:

- Async `params` / `searchParams` on App Router handlers and pages
- `next.config.js` changes (`instrumentationHook`, `outputFileTracingIncludes`)
- `eslint-config-next` must match `next` in **both** apps
- Full `pnpm test`, `pnpm build`, `pnpm test:a11y`, gossip-compat

**Why eventually:** Some Next.js security advisories are fixed only on the 15.x line (no backport to 14.2.35). Until migration, accept interim exposure on 14.x or dismiss alerts with this roadmap linked.

**Scope checklist (when scheduled):**

- [ ] Bump `next` + `eslint-config-next` in `apps/node` and `apps/access`
- [ ] Regenerate `pnpm-lock.yaml`
- [ ] Update dynamic API routes and pages for async route context
- [ ] Fix `apps/node/next.config.js` and `apps/access/next.config.js` for Next 15
- [ ] Run full CI + manual smoke on node, Access, Lens proxy paths
- [ ] Document operator impact in [CHANGELOG.md](../CHANGELOG.md) and [UPGRADE.md](./UPGRADE.md)

**Dependabot:** Close major-version Next PRs with `@dependabot ignore this major version` on the PR. Security-update PRs within 14.x are still welcome when patches exist.

---

## Phase 6 (broader)

See [RELEASE-PHASES.md](./RELEASE-PHASES.md#phase-6--community-scale):

- `@wikitraveler/sdk` on npm
- Chrome Web Store (or signed channel) for Lens
- Monthly minor release cadence
- RFC template for gossip/auth/schema changes
