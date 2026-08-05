# Upgrade runbook

Upgrade a **production node** and, if you operate one, a **hub or branded Access** deployment to a new WikiTraveler release. Access is a separate client artifact ([OPERATORS.md](./OPERATORS.md#audiences)).

**Before you start:** read the target version in [CHANGELOG.md](../CHANGELOG.md) and [RELEASES.md](./RELEASES.md).

---

## Golden rules

1. **Backup first** — Admin gzip export or database snapshot.
2. **Migrate before code** — If the release includes Prisma migrations, run `pnpm db:deploy` before starting the new app version.
3. **Verify after** — `GET /api/health`, peer gossip, hub Access login (and a foreign-region resolve if you mesh).
4. **Node + Access pair when contracts break** — Viewport map and similar client/API changes need both redeployed (**H5** / [COMPATIBILITY.md](./COMPATIBILITY.md)).
5. **Rollback = previous image/tag + restore backup** — Prisma production rollbacks are not `migrate reset`.

---

## Docker node upgrade

### 1. Backup

```bash
# Admin API backup (requires admin session) or provider DB snapshot
curl -H "Cookie: wt_token=..." https://node.example.com/api/admin/backup -o backup-$(date +%F).json.gz
```

### 2. Note current version

```bash
curl -s https://node.example.com/api/health | jq .version
```

### 3. Pull or build new image

**From registry (when published):**

```bash
export WIKITRAVELER_VERSION=0.3.0   # target tag
docker compose -f docker/docker-compose.yml pull node
```

**From source:**

```bash
git fetch --tags
git checkout v0.3.0
docker compose -f docker/docker-compose.yml build node
```

### 4. Run migrations

The entrypoint runs `prisma migrate deploy` on start. To run explicitly:

```bash
docker compose -f docker/docker-compose.yml run --rm node prisma migrate deploy
```

Or from the host (same `DATABASE_URL` as production):

```bash
git checkout v0.3.0
DATABASE_URL="postgresql://..." pnpm db:deploy
```

### 5. Restart

```bash
docker compose -f docker/docker-compose.yml up -d node
```

### 6. Verify

```bash
curl -s https://node.example.com/api/health | jq .
# Optional against a peer:
pnpm gossip:check
```

### 7. WikiTraveler Access (Docker profile)

If you run Access in Compose and the node URL or client API changed:

```bash
# Update NEXT_PUBLIC_NODE_API_URL in .env if needed
docker compose -f docker/docker-compose.yml --profile access up --build -d access
```

---

## Vercel node upgrade

### 1. Backup

Database provider snapshot or Admin export.

### 2. Apply migrations (from your machine)

```bash
git checkout v0.3.0
DATABASE_URL="postgresql://production..." pnpm db:deploy
```

Do this **before** promoting the Vercel deployment that expects new schema.

### 3. Deploy

- **Git integration:** merge or deploy the `v0.3.0` tag (production branch pinned to tags recommended).
- **CLI:** `vercel deploy --prod` from tag checkout.

### 4. Verify crons

Confirm `CRON_SECRET` unchanged and cron routes still authorized. See [VERCEL.md](./VERCEL.md).

### 5. WikiTraveler Access (Vercel)

Separate project (hub, backup, or branded) — redeploy if:

- `NEXT_PUBLIC_NODE_API_URL` (default home node) changed, or
- Release notes mention Access API / map contract changes (**H5** — redeploy node too).

Keep backup Access origins on node `CLIENT_ORIGINS` through the upgrade (**H4**).
---

## Hybrid (ingest local, API on Vercel)

Common pattern: large OSM ingest on Docker/local, API on Vercel sharing `DATABASE_URL`.

1. Upgrade **database** first (`pnpm db:deploy`).
2. Upgrade **Vercel node** deployment.
3. Re-ingest is **not** required for app upgrades — only when you intentionally refresh OSM data.

---

## Gossip compatibility during upgrades

| Situation | Expected behaviour |
|-----------|-------------------|
| You on `0.3`, peer on `0.2` | Gossip should work for shared fields |
| You upgraded DB, peer has not | Your node accepts deltas; peer may fail if you send new required fields |
| Peer offline during upgrade | Cron gossip catches up within 6h after both are up |

Stagger upgrades across the mesh when [CHANGELOG.md](../CHANGELOG.md) marks a release as **gossip breaking**. No need to coordinate for routine patches.

---

## Rollback

| Platform | Action |
|----------|--------|
| Docker | Set `WIKITRAVELER_VERSION` to previous tag; `up -d` |
| Vercel | Promote previous deployment in dashboard |
| Database | Restore pre-upgrade backup — **do not** run `prisma migrate reset` on production |

If a migration already ran forward, rolling back code without restoring DB may cause runtime errors. Prefer restore over partial rollback.

---

## Post-upgrade operator checklist

- [ ] `/api/health` version matches target release
- [ ] Admin login works
- [ ] Map loads properties in configured region
- [ ] At least one peer syncs (if federated)
- [ ] Access app connects and authenticates
- [ ] Crons executed (check Vercel logs or manual `GET /api/cron/gossip` with secret)

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| 500 on API after deploy | Migration not applied | `pnpm db:deploy`, restart |
| Gossip 401 | Missing or rotated peer keys | `pnpm gossip:link-peers` |
| Empty map after upgrade | Region bbox unset | Admin → Region |
| Access cannot login | CORS or wrong `NEXT_PUBLIC_NODE_API_URL` | Fix env, rebuild Access |

More federation debugging: [GOSSIP-DEV.md](./GOSSIP-DEV.md).
