# WikiTraveler 🌍🔓

> **The Distributed Travel Truth-Layer** — because booking apps can't be trusted. The community can.

WikiTraveler is a 100% open-source, federated protocol that sidecars real-world accessibility intelligence onto global travel platforms. Traditional booking sites provide outdated, vague, or missing data. WikiTraveler provides the Ground Truth — community-audited, multi-node verified, and impossible to paywall.

---

## The Manifesto

**The Vision** — Replace the broken, unreliable data of corporate booking apps with a Distributed Truth Layer. Travelers deserve certainties, not best guesses. Community-driven data stays free, open, and verified by people who actually stand on the ground.

**The Mission** — Bypass the "performative accuracy" of global travel sites. WikiTraveler is an open-source sidecar that injects high-resolution, community-audited intelligence directly into your browser. Field Audits confirm ground truth. A Federated Mesh of nodes ensures the truth can never be paywalled.

**The Strategy: Community-Owned Certainty**

1. **Expose** — Ingest official Amadeus tags to highlight where data is missing or vague.
2. **Verify** — Use the Field Kit and Lens to override corporate claims with real-world specs.
3. **Decentralize** — Deploy a distributed network of nodes on Vercel or Docker for data sovereignty.
4. **Gossip** — Sync verified insights via delta snapshots so community truth scales faster than any booking app.
5. **Open-Source** — Keep the protocol 100% free and open, allowing anyone to build on top of the mesh.

---

## Reliability Stack

| Tier | Source    | Label        | Meaning                                      |
|------|-----------|--------------|----------------------------------------------|
| 0    | Amadeus   | `OFFICIAL`   | Unreliable baseline. Often vague or missing. |
| 1    | AI Agent  | `AI_GUESS`   | Machine-estimated spec to guide auditors.    |
| 2    | Community | `COMMUNITY`  | Ground truth. Verified by a fellow traveler. |
| 3    | Mesh      | `MESH_TRUTH` | Consensus-verified by >= 3 distinct nodes.   |

Higher tiers always win. A `MESH_TRUTH` value overrides `OFFICIAL` and `COMMUNITY` for the same field.

---

## Toolkit

| Component       | Path                | Description                                                      |
|-----------------|---------------------|------------------------------------------------------------------|
| **Node**        | `apps/node`         | Next.js API + dashboard. Deploy on Vercel or Docker.             |
| **Field Kit**   | `apps/field-kit`    | Mobile-first Next.js app for on-site photo audits.               |
| **Lens**        | `apps/lens`         | Chrome MV3 extension. Overlays data on Booking.com and Expedia.  |
| **Agency Demo** | `apps/agency-demo`  | Static HTML demo showing three SDK integration patterns.         |
| **Core**        | `packages/core`     | Shared types, tier constants, gossip merge logic.                |
| **SDK**         | `packages/sdk`      | Browser SDK for travel agencies (CJS + ESM + UMD).               |

---

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) v20+
- [pnpm](https://pnpm.io/) v9+ — `npm install -g pnpm`
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (optional)
- PostgreSQL 16 (or use the Docker Compose setup below)

### 1. Install dependencies

```bash
git clone https://github.com/your-org/wikitraveler.git
cd wikitraveler
pnpm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env — at minimum set DATABASE_URL, JWT_SECRET, COMMUNITY_PASSPHRASE
```

### 3. Set up the database

```bash
pnpm exec prisma migrate dev --name init
pnpm db:seed
```

### 4. Start the node

```bash
pnpm dev              # starts apps/node on http://localhost:3000
```

Visit `http://localhost:3000` for the dashboard or `http://localhost:3000/api/health` to verify.

### 5. Docker (fastest path — no local Postgres needed)

```bash
docker compose -f docker/docker-compose.yml up --build
```

---

## Monorepo Structure

```
wikitraveler/
├── apps/
│   ├── node/            # Next.js node (API + dashboard)
│   ├── field-kit/       # Next.js mobile audit app
│   ├── lens/            # Chrome MV3 extension
│   └── agency-demo/     # Static agency SDK demo
├── packages/
│   ├── core/            # Shared types & gossip merge logic
│   └── sdk/             # Browser SDK (CJS + ESM + UMD)
├── prisma/
│   └── schema.prisma    # Database schema (PostgreSQL)
├── docker/
│   ├── Dockerfile
│   ├── docker-compose.yml              # Single node
│   └── docker-compose.gossip-demo.yml # Two-node gossip demo
├── scripts/
│   └── seed.ts          # Database seeder
├── .env.example         # Environment variable reference
└── vercel.json          # Vercel deployment config
```

---

## Documentation

| Document                                        | Description                                           |
|-------------------------------------------------|-------------------------------------------------------|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)   | System design, data flow, gossip protocol, API surface |
| [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)     | Local setup, per-package build and config guide       |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)       | Docker, Vercel, and production hardening              |

---

## Root Scripts

| Script              | Description                              |
|---------------------|------------------------------------------|
| `pnpm dev`          | Start `apps/node` in dev mode            |
| `pnpm build`        | Build all packages and apps              |
| `pnpm db:generate`  | Regenerate Prisma client                 |
| `pnpm db:migrate`   | Run Prisma migrations                    |
| `pnpm db:seed`      | Seed database with sample properties     |

---

## License

MIT. Data contributed to the mesh is released under CC-BY 4.0.
