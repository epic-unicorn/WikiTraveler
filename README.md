# WikiTraveler 🌍

WikiTraveler is a open-source, federated protocol that sidecars real-world accessibility intelligence onto global travel platforms. Traditional booking sites provide outdated, vague, or missing data. WikiTraveler provides the Ground Truth — community-audited, multi-auditor confirmed, and impossible to paywall.

---

## The Manifesto

**The Vision** — Replace the broken, unreliable data of corporate booking apps with a Distributed Truth Layer. Travelers deserve certainties, not best guesses. Community-driven data stays free, open, and verified by people who actually stand on the ground.

**The Mission** — Bypass the "performative accuracy" of global travel sites. WikiTraveler is an open-source sidecar that injects high-resolution, community-audited intelligence directly into your browser. Field Audits confirm ground truth. A Federated Mesh of nodes ensures the truth can never be paywalled.

**The Strategy: Community-Owned Certainty**

1. **Expose** — Ingest open directory records (Wikidata, OpenStreetMap) to highlight where accessibility data is missing or vague.
2. **Verify** — Use the Field Kit and Lens to override corporate claims with real-world specs.
3. **Decentralize** — Deploy a distributed network of nodes on Vercel or Docker for data sovereignty.
4. **Gossip** — Sync verified insights via delta snapshots so community truth scales faster than any booking app.
5. **Federate** — Push new `VERIFIED` facts to peer nodes in real time via signed inbox messages (ActivityPub-inspired). Each node publishes its identity and public key at `/.well-known/webfinger` for automatic discovery.
6. **Open-Source** — Keep the protocol 100% free and open, allowing anyone to build on top of the mesh.

---

## Reliability Stack

| Tier | Source         | Label       | Meaning                                                                  |
| ---- | -------------- | ----------- | ------------------------------------------------------------------------ |
| 0    | Wikidata / OSM | `OFFICIAL`  | Community baseline from open sources. Foundational but often incomplete. |
| 1    | AI Agent       | `AI_GUESS`  | Machine-estimated spec to guide auditors.                                |
| 2    | Community      | `VERIFIED`  | Ground truth. Verified by a fellow traveler.                             |
| 3    | Mesh           | `CONFIRMED` | Independently verified by ≥3 distinct auditors.                          |

Higher tiers always win. A `CONFIRMED` value overrides `OFFICIAL` and `VERIFIED` for the same field.

---

## Toolkit

| Component       | Path                | Description                                                     |
| --------------- | ------------------- | --------------------------------------------------------------- |
| **Node**        | `apps/node`         | Next.js API + dashboard. Deploy on Vercel or Docker. Search, rich map with "Audited only" filter. |
| **Field Kit**   | `apps/field-kit`    | Mobile-first Next.js app for on-site photo audits. Login gate — auditors only. |
| **Lens**        | `apps/lens`         | Chrome MV3 extension. Overlays data on Booking.com and Expedia. Popup login + register link. |
| **Agency Demo** | `apps/agency-demo`  | Static HTML demo showing three SDK integration patterns.        |
| **Core**        | `packages/core`     | Shared types, tier constants, gossip merge logic.               |
| **SDK**         | `packages/sdk`      | Browser SDK for travel agencies (CJS + ESM + UMD).              |
| **AI Agent**    | `packages/ai-agent` | GPT-4o vision analysis and text-based gap-filling engine.       |

**Key node endpoints:**

| Endpoint                                  | Description                                                       |
| ----------------------------------------- | ----------------------------------------------------------------- |
| `GET /api/nodeinfo`                       | Node identity, public key, bbox, and known peers                  |
| `GET /.well-known/pubkey`                 | RS256 public key (used by peer nodes to verify JWTs)              |
| `GET /api/peers/resolve?lat=&lon=`        | Returns the best regional peer for a coordinate (requires auth)   |
| `POST /api/auth/register`                 | Create a user account (role defaults to USER, pending approval)   |
| `POST /api/auth/login`                    | Login — returns a signed RS256 JWT with `role` claim              |
| `GET /api/properties/map`                 | All geo-tagged properties with key facts + `audited` flag         |
| `POST /api/gossip/ingest`                 | Receive a gossip delta from a peer node                           |
| `POST /api/inbox`                         | Real-time signed fact push from peer nodes                        |
| `POST /api/properties/[id]/accessibility` | Submit an audit; triggers immediate peer push + background vision |

---

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) v20+
- [pnpm](https://pnpm.io/) v9+ — `npm install -g pnpm`
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) — for the Postgres container

### 1. Install & configure

```bash
git clone https://github.com/your-org/wikitraveler.git
cd wikitraveler
pnpm install
cp .env.example .env        # edit DATABASE_URL, NODE_PRIVATE_KEY, NODE_PUBLIC_KEY
```

### 2. Start Postgres

```bash
docker compose -f docker/docker-compose.dev.yml up postgres -d
```

### 3. Migrate & seed

```bash
pnpm db:migrate               # node schema
pnpm db:seed
```

On first start the node auto-creates the admin account from `.env`:
```env
ADMIN_USERNAME=admin
ADMIN_PASSWORD=change-me-in-production
```
Comment those lines out after the account is created.

### 4. Run the apps

| Terminal | Command                | URL                                                |
| -------- | ---------------------- | -------------------------------------------------- |
| 1        | `pnpm dev`             | http://localhost:3000 — node dashboard + API       |
| 2        | `pnpm dev:field-kit`   | http://localhost:3001 — mobile audit app           |
| 3        | `pnpm dev:agency-demo` | http://localhost:4000/apps/agency-demo/ — SDK demo |

See [apps/README.md](apps/README.md) for step-by-step flow walkthroughs.

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
│   ├── sdk/             # Browser SDK (CJS + ESM + UMD)
│   └── ai-agent/        # GPT-4o vision + gap-fill engine
├── prisma/schema.prisma # Database schema (PostgreSQL)
├── docker/              # Dockerfiles + compose files
├── scripts/             # seed.ts, osm-ingest.ts
└── .env.example         # Environment variable reference
```

---

## Scripts

| Script                 | Description                              |
| ---------------------- | ---------------------------------------- |
| `pnpm dev`             | Start node on :3000                      |
| `pnpm dev:field-kit`   | Start field-kit on :3001                 |
| `pnpm dev:agency-demo` | Build SDK + serve agency demo on :4000   |
| `pnpm build`           | Build all packages and apps              |
| `pnpm db:migrate`      | Apply pending node schema migrations     |
| `pnpm db:seed`         | Seed database with sample properties     |
| `pnpm db:setup`        | Full reset of both databases + seed      |
| `pnpm osm:ingest`      | Ingest OpenStreetMap data                |

---

## License

MIT. Data contributed to the mesh is released under CC-BY 4.0.
