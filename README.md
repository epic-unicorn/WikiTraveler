# WikiTraveler 🌍🔓

> **The Distributed Travel Truth-Layer** — because booking apps can't be trusted. The community can.

WikiTraveler is a open-source, federated protocol that sidecars real-world accessibility intelligence onto global travel platforms. Traditional booking sites provide outdated, vague, or missing data. WikiTraveler provides the Ground Truth — community-audited, multi-node verified, and impossible to paywall.

---

## Why WikiTraveler Exists

### The Amadeus Problem

**Amadeus** is the world's largest travel technology company. It operates the Global Distribution System (GDS) that underpins the majority of hotel, flight, and car-rental bookings on earth. When you search for a hotel on Booking.com, Expedia, Hotels.com, Kayak, or any major OTA (Online Travel Agency), the underlying property data — room counts, amenities, policies, check-in times — almost always originates from the Amadeus GDS or its direct competitors (Sabre, Travelport).

Airlines, hotel chains, and independent properties pay Amadeus to list their inventory. Travel agencies, OTAs, and corporate booking tools pay Amadeus to access it. The data flows through APIs like the **Amadeus Hotel Search API**, which returns structured records for hundreds of thousands of properties worldwide.

### Who relies on Amadeus data

- **Online Travel Agencies** — Booking.com, Expedia, Hotels.com, Agoda, Trip.com
- **Corporate travel tools** — Concur, Egencia, TravelPerk, Navan
- **Airline booking flows** — virtually every major carrier's "add a hotel" flow
- **Meta-search engines** — Google Hotels, Kayak, Trivago
- **Accessibility travel platforms** — sites specifically serving travellers with disabilities that rely on the same underlying feed

### What Amadeus is missing

Amadeus excels at inventory — it knows a hotel has 200 rooms and accepts Visa. It is systematically weak on the details that matter most to specific travellers:

| Gap | Why it exists |
|-----|---------------|
| **Accessibility specs are sparse** | Hotels self-report. There is no verification. "Accessible room available" is not the same as "doorway is 85 cm wide". |
| **Vague binary flags** | The API returns `"accessibleParking": true` with no further detail. How many spaces? How far from the entrance? |
| **Stale data** | Properties update Amadeus records infrequently. A renovation three years ago may have added a ramp that is not in the feed. |
| **Commercial incentive to over-claim** | Properties are motivated to tick every amenity checkbox to appear in more searches. There is no penalty for inaccuracy. |
| **No photo evidence** | Accessibility claims are text assertions with no supporting imagery. |
| **No community correction mechanism** | If a traveller discovers a hotel lied about accessibility, there is no channel in the GDS to flag it. The bad data persists indefinitely. |
| **Proprietary and paywalled** | The raw data is not publicly accessible. Researchers, disability advocates, and independent developers cannot audit or improve it. |

### What WikiTraveler does instead

WikiTraveler treats Amadeus data as a **starting point**, not a source of truth. It ingests official records to understand what fields are claimed and where the gaps are, then layering three additional tiers on top:

1. **AI estimates** — GPT-4o analyses photos and generates measurable estimates for fields that the official record leaves blank, giving auditors a pre-filled baseline before they even arrive at the property.
2. **Community audits** — Field auditors verify on the ground with photos and precise measurements. A single community audit instantly outranks any official or AI-generated claim.
3. **Mesh consensus** — When three or more independent nodes corroborate the same value, it is promoted to `MESH_TRUTH` — the only tier that cannot be overridden by a single party.

All of this runs on infrastructure you own and deploy. No data is locked behind a paywall. No single company controls what the community knows.

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
| **AI Agent**    | `packages/ai-agent` | GPT-4o vision analysis and text-based gap-filling engine.        |

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
│   ├── sdk/             # Browser SDK (CJS + ESM + UMD)
│   └── ai-agent/        # GPT-4o vision + gap-fill engine
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
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)   | System design, data flow, AI agent, gossip protocol, API surface |
| [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)     | Local setup, per-package build and config guide (incl. AI agent) |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)       | Docker, Vercel, production hardening, OpenAI key setup           |

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
