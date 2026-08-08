# Gossip lab dev keys

These RSA keypairs are **for local gossip-lab testing only**. They are mounted into
Docker containers via `docker-compose.gossip.yml` / `docker-compose.gossip-mesh3.yml`
and must never be used in production.

| Files | Source |
|-------|--------|
| `node-a.*.pem`, `node-b.*.pem` | Committed lab fixtures (2-node discovery/compat) |
| `node-c.*.pem` | **Generated** via `pnpm gossip:ensure-lab-keys` (gitignored) |

```bash
pnpm gossip:ensure-lab-keys   # creates any missing pairs (incl. node-c)
# or manually:
openssl genrsa -out node-a.private.pem 2048
openssl rsa -in node-a.private.pem -pubout -out node-a.public.pem
# …same for node-b / node-c
```

`pnpm dev:gossip-lab-mesh3` runs `gossip:ensure-lab-keys` first. CI does the same before the Tier B job.
