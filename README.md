# WikiTraveler 🌍🔓

> **The Distributed Travel Truth-Layer** — because booking apps can't be trusted. The community can.

WikiTraveler is a open-source, federated protocol that sidecars real-world accessibility intelligence onto global travel platforms. Traditional booking sites provide outdated, vague, or missing data. WikiTraveler provides the Ground Truth — community-audited, multi-auditor confirmed, and impossible to paywall.

---

## Why WikiTraveler Exists

### The Problem with Travel Apps

Open any major booking app — Booking.com, Expedia, Hotels.com, Google Hotels, Kayak — and search for a hotel that's accessible to a wheelchair user. You'll see a badge: "Accessible room available." Maybe a bullet point: "Roll-in shower." Perhaps a tick next to "elevator."

**That's where the information ends.**

How wide is the doorway? Is the shower actually roll-in or just a low lip? How many steps between the parking garage and reception? Is there a hearing loop in the conference room? These are the details that determine whether a trip is possible — and none of these apps can reliably answer them.

The apps aren't lying. They're just passing through whatever the hotel self-reported into the Global Distribution System (GDS) — the backend data layer operated by companies like Amadeus, Sabre, and Travelport that powers virtually every OTA on earth. Hotels file a checklist. The GDS stores it. The booking apps display it. Nobody verifies it.

### Why the apps can't fix it

The problem isn't a bug in any single app. It's structural:

| Root cause | What it means in practice |
|------------|---------------------------|
| **Hotels self-report with no verification** | "Accessible bathroom" can mean a grab bar was installed in 1998. There is no audit. |
| **Binary flags, no measurements** | `accessibleParking: true` tells you nothing about the distance to the entrance or the gradient of the path. |
| **Stale records** | Hotels update GDS records infrequently. A renovation that blocked the ramp three years ago may still show as accessible. |
| **Commercial incentive to over-claim** | Ticking more amenity boxes = appearing in more searches. There is no penalty for inaccuracy. |
| **No photo evidence** | Every accessibility claim is a text assertion. There is no image to verify it against. |
| **No correction channel** | A traveller who discovers the hotel lied has no way to flag it inside the booking system. The bad data persists indefinitely. |
| **Locked data** | The underlying GDS records are proprietary and paywalled. Researchers, disability advocates, and independent developers cannot audit or improve them. |

The result: travellers with disabilities, specific medical needs, or dependents who rely on precise specs are forced to book on faith — and frequently arrive to find the reality doesn't match the listing.

### What WikiTraveler does instead

WikiTraveler bypasses the broken self-reporting loop entirely. It treats any external directory data as a **starting point**, not a source of truth, then layers three tiers of increasingly reliable intelligence on top:

1. **AI estimates** — GPT-4o analyses property photos and generates measurable estimates for fields left blank by official records, giving auditors a pre-filled baseline before they even arrive on site.
2. **Community audits** — Field auditors verify on the ground with photos and precise measurements. A single community audit instantly outranks any official or AI-generated claim.
3. **Mesh consensus** — When three or more independent auditors submit the same value, it is promoted to `CONFIRMED` — the only tier that cannot be reached by a single person.

All of this runs on infrastructure you own and deploy. No data is locked behind a paywall. No single company controls what the community knows.

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

| Tier | Source    | Label        | Meaning                                      |
|------|-----------|--------------|----------------------------------------------|
| 0    | Wikidata / OSM | `OFFICIAL`   | Community baseline from open sources. Foundational but often incomplete. |
| 1    | AI Agent  | `AI_GUESS`   | Machine-estimated spec to guide auditors.    |
| 2    | Community | `VERIFIED`   | Ground truth. Verified by a fellow traveler. |
| 3    | Mesh      | `CONFIRMED`  | Independently verified by ≥3 distinct auditors. |

Higher tiers always win. A `CONFIRMED` value overrides `OFFICIAL` and `VERIFIED` for the same field.

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

**Key node endpoints:**

| Endpoint | Description |
|----------|-------------|
| `GET /.well-known/webfinger` | Node discovery — returns identity, public key, and inbox URL |
| `GET /api/nodeinfo` | Node identity and RSA public key (for peer key caching) |
| `POST /api/inbox` | Real-time signed fact push from peer nodes |
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
cp .env.example .env        # edit DATABASE_URL, JWT_SECRET, COMMUNITY_PASSPHRASE
```

### 2. Start Postgres

```bash
docker compose -f docker/docker-compose.dev.yml up postgres -d
```

### 3. Migrate & seed

```bash
pnpm db:migrate
pnpm db:seed
```

### 4. Run the apps

| Terminal | Command | URL |
|----------|---------|-----|
| 1 | `pnpm dev` | http://localhost:3000 — node dashboard + API |
| 2 | `pnpm dev:field-kit` | http://localhost:3001 — mobile audit app |
| 3 | `pnpm dev:agency-demo` | http://localhost:4000/apps/agency-demo/ — SDK demo |

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
├── scripts/             # seed.ts, mock-node.ts
└── .env.example         # Environment variable reference
```

---

## Scripts

| Script | Description |
|--------|-------------|
| `pnpm dev` | Start node on :3000 |
| `pnpm dev:field-kit` | Start field-kit on :3001 |
| `pnpm dev:agency-demo` | Build SDK + serve agency demo on :4000 |
| `pnpm mock-node` | In-memory mock node (no Postgres needed) |
| `pnpm build` | Build all packages and apps |
| `pnpm db:migrate` | Run Prisma migrations |
| `pnpm db:seed` | Seed database with sample properties |

---

## License

MIT. Data contributed to the mesh is released under CC-BY 4.0.
