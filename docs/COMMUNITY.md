# Community

WikiTraveler is built for a **federated mesh** — independent operators, shared protocol, community-owned data. This guide explains how people participate and how the project scales with a larger community.

---

## Roles in the ecosystem

| Role | What you do | Primary docs |
|------|-------------|--------------|
| **Traveler** | Browse accessibility facts via Access or agency widgets | Use a public Access URL from your regional operator |
| **Auditor** | Submit on-site verified audits | [apps/README.md](../apps/README.md) Flow 2 |
| **Node operator** | Run a sovereign regional node (API + data) | [OPERATORS.md](./OPERATORS.md) |
| **Client maintainer** | Deploy or customize Access, Lens, SDK integrations | [DEVELOPMENT.md](./DEVELOPMENT.md) |
| **Core contributor** | Protocol, gossip, merge logic, shared packages | [CONTRIBUTING.md](../CONTRIBUTING.md) |
| **Maintainer** | Releases, migrations, federation compatibility | [RELEASES.md](./RELEASES.md) |

No central vendor is required. Operators choose when to deploy; contributors improve the open toolkit everyone shares.

---

## How the mesh grows

1. **Bootstrap peers** — New nodes list known peers in `BOOTSTRAP_PEERS`; startup discovery expands the peer table.
2. **Gossip exchange** — Every sync includes peer lists; the network discovers itself organically.
3. **Regional resolution** — Clients call `/api/peers/resolve` so travelers reach the right regional node.
4. **Shared releases** — Tagged repo releases give operators a common baseline without forced remote updates.

Operators are **not** required to run the latest version immediately. The project supports **N and N-1** node versions in the mesh. Breaking changes get a documented sunset window — see [RELEASES.md](./RELEASES.md).

---

## Contributing code

1. Read [CONTRIBUTING.md](../CONTRIBUTING.md) for branch naming, PR checks, and review expectations.
2. Set up locally via [DEVELOPMENT.md](./DEVELOPMENT.md) and [LOCAL.md](./LOCAL.md).
3. For federation changes, run the gossip lab: [GOSSIP-DEV.md](./GOSSIP-DEV.md).
4. For UI changes, run accessibility checks: [ACCESSIBILITY.md](./ACCESSIBILITY.md).

**Good first contributions:** docs fixes, i18n strings (`packages/i18n`), test coverage, operator runbook improvements, sample region presets.

**Needs design discussion first:** gossip protocol shape changes, Prisma breaking migrations, auth model changes.

---

## Contributing as an operator

You do not need to merge code to participate:

- Run a public node and list it as a bootstrap peer (with permission).
- Publish your Access URL for travelers in your region.
- Share OSM ingest experience and bbox presets.
- Report federation issues with `pnpm gossip:check` output and peer `/api/nodeinfo` responses.

Use the **Operator help** issue template when asking for deployment support.

---

## Communication norms

- **Be specific** — Include node version (`/api/health`), deployment type (Docker/Vercel), and migration state.
- **Respect sovereignty** — Operators control their infrastructure; avoid prescriptive “everyone must upgrade today” unless security-critical.
- **Document decisions** — Federation and API changes belong in `docs/` and [CHANGELOG.md](../CHANGELOG.md).
- **Follow the [Code of Conduct](../CODE_OF_CONDUCT.md)** in all project spaces.

---

## Governance (lightweight)

Today the project uses **maintainer-led merge** on `main`:

- `main` is always intended to be deployable.
- Releases are tagged `vMAJOR.MINOR.PATCH` with notes in [CHANGELOG.md](../CHANGELOG.md).
- Breaking gossip or database changes require a [RELEASES.md](./RELEASES.md) compatibility note before merge.

As the community grows, maintainers may add:

- A public roadmap (GitHub Projects or `docs/ROADMAP.md`)
- Operator office hours or Matrix/Discord (linked from README when established)
- A static release manifest for advisory upgrade banners

None of these replace per-operator deployment control.

---

## Licensing & data

| Asset | License |
|-------|---------|
| Source code | MIT — see [README](../README.md) |
| Mesh-contributed facts | CC-BY 4.0 |

Operators and integrators should attribute WikiTraveler data per CC-BY when republishing.

---

## Next steps

| Goal | Link |
|------|------|
| Set up dev environment | [DEVELOPMENT.md](./DEVELOPMENT.md) |
| Deploy a node | [OPERATORS.md](./OPERATORS.md) |
| Understand federation | [ARCHITECTURE.md](./ARCHITECTURE.md) § Federation & Gossip |
| Release or upgrade | [RELEASES.md](./RELEASES.md) · [UPGRADE.md](./UPGRADE.md) |
