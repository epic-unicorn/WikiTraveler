# Operator checklist

Post-deploy verification for a WikiTraveler node (and optional Access client).

**Related:** [OPERATORS.md](./OPERATORS.md) · [UPGRADE.md](./UPGRADE.md) · [DOCKER.md](./DOCKER.md)

---

## After first deploy

Run from your workstation (replace the node URL):

```bash
export NODE_URL=https://your-node.example.com
pnpm doctor
```

Expected: version aligned, migrations up to date, `/api/health` and `/api/nodeinfo` reachable, RS256 keys configured in production.

### HTTP smoke tests

```bash
curl -s "$NODE_URL/api/health" | jq .
curl -s "$NODE_URL/api/nodeinfo" | jq .
```

| Check | Expected |
|-------|----------|
| `ok` | `true` |
| `version` | Matches your deployed tag (e.g. `0.2.0`) |
| `nodeId` | Stable value from `NODE_ID` |
| `publicKeyPem` | Present in production |
| `gossipProtocol` | Integer (currently `2`; min supported `1`) |
| `exportSchema` | Integer (currently `2`) |

### Admin UI

- [ ] Sign in as admin → complete **Region & data** (bbox or sample load)
- [ ] **Statistics** loads without errors
- [ ] **Peers** — add a bootstrap peer or confirm `BOOTSTRAP_PEERS` linked on startup
- [ ] Upgrade banner (if enabled) — advisory only; no action required when current

### Database

- [ ] `pnpm db:deploy` applied (Docker entrypoint runs this on start; verify once manually after upgrades)
- [ ] Backup path documented (Admin gzip export or provider snapshot)

---

## After every upgrade

1. Read [CHANGELOG.md](../CHANGELOG.md) for migration or gossip notes.
2. Backup database or Admin export.
3. Deploy new image/tag — see [UPGRADE.md](./UPGRADE.md).
4. Run `pnpm db:deploy` if the release includes Prisma migrations.
5. Re-run `pnpm doctor` against production `NODE_URL`.
6. Confirm Admin **Peers** show expected versions (Phase 4 skew warnings should be green for N ↔ N-1 mesh).
7. If you run Access: rebuild with matching `WIKITRAVELER_VERSION` and check **Settings** — node and client versions should align.

---

## Federation check (optional)

With gossip lab or two production peers:

```bash
pnpm gossip:check
# or against production:
NODE_A_URL=https://node-a.example.com NODE_B_URL=https://node-b.example.com pnpm gossip:check
```

---

## Release manifest (optional)

Published at [releases/manifest.json](../releases/manifest.json) and attached to GitHub Releases as `manifest.json`.

- Admin dashboard fetches it when `RELEASE_MANIFEST_URL` is unset (default: raw GitHub `main` copy).
- Override with `RELEASE_MANIFEST_URL` for air-gapped or mirror deployments.
- Banners are **advisory** — operators choose when to upgrade.

---

## Troubleshooting

| Symptom | Action |
|---------|--------|
| `doctor` migration errors | Set `DATABASE_URL`, run `pnpm db:deploy` |
| Missing `publicKeyPem` | Set `NODE_PUBLIC_KEY` / `NODE_PRIVATE_KEY` |
| Peer unreachable | Check HTTPS, firewall, `NODE_URL` matches certificate |
| Access/node version mismatch | Rebuild Access or upgrade node to match |
| Upgrade banner stale | Confirm `releases/manifest.json` on `main` matches latest tag |

Report issues with the **Operator help** GitHub template; include `pnpm doctor` output (redact secrets).
