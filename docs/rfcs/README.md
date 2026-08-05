# RFC process

WikiTraveler uses lightweight RFCs before merging changes that affect the **federated mesh** — gossip wire format, auth trust, or Prisma schema that other operators must migrate.

## When you need an RFC

Open an RFC issue (template: **RFC**) if your change:

- Adds or removes fields on `GossipDelta` / gossip auth headers
- Changes JWT / node signature verification
- Introduces a breaking or additive Prisma migration that operators must run
- Raises `GOSSIP_PROTOCOL_VERSION` or `MIN_SUPPORTED_GOSSIP_PROTOCOL`
- Changes how Access/Lens resolve peers or verify cross-node tokens
- Changes production CORS / trusted client-origin policy for hub Access or Lens

## Process

1. File a GitHub issue with the **RFC** template.
2. Discuss until a maintainer labels it `rfc/accepted` or `rfc/declined`.
3. Implement in a PR that links the RFC issue.
4. Update [COMPATIBILITY.md](../COMPATIBILITY.md), [CHANGELOG.md](../../CHANGELOG.md), and [versions.json](../../versions.json) when protocol or schema numbers change.

## Protocol notes (no production mesh yet)

As of the Phase 6 cut there are **no known public production nodes**. Protocol bumps may raise `MIN_SUPPORTED_GOSSIP_PROTOCOL` without a long sunset when maintainers agree — still document the change in an RFC and the changelog so early operators are not surprised.

## Index

| RFC | Title | Status |
|-----|-------|--------|
| [0001](./0001-gossip-protocol-2.md) | Gossip protocol version 2 | Accepted |
| [0002](./0002-global-hub-access.md) | Global hub Access & Lens (federation invisible) | Accepted ([#51](https://github.com/ingmarstruijs/WikiTraveler/issues/51)) |

Accepted RFCs live as `docs/rfcs/NNNN-slug.md` after acceptance.
