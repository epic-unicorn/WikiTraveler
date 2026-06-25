<p align="center">
  <img src="docs/assets/wikitraveler-mark.svg" width="72" alt="WikiTraveler logo" />
</p>

<h1 align="center">WikiTraveler</h1>

<p align="center">
  <strong>Open-source, federated accessibility intelligence for travel.</strong><br />
  Real specs from the field — not marketing copy from a booking site.

  WikiTraveler sidecars verified accessibility facts onto hotels and destinations.
  Auditors capture ground truth with WikiTraveler Access and Lens; independent nodes gossip those facts
  across a peer mesh so the data stays community-owned and free to use.
</p>

---

## Why WikiTraveler exists

Corporate travel platforms often show accessibility information that is vague, outdated, or missing entirely. WikiTraveler treats that gap as a protocol problem, not a content problem: structured facts, clear trust tiers, and federation so no single vendor can gatekeep the truth.

---

## How it works

1. **Baseline** — Configure your region in Admin, then ingest open directory data (OpenStreetMap) as a starting `OFFICIAL` layer.
2. **Audit** — WikiTraveler Access and Lens let travelers and auditors record what is actually on the ground, upgrading facts to `VERIFIED`.
3. **Confirm** — When independent auditors agree, facts rise to `CONFIRMED` — the highest tier wins.
4. **Deploy** — Run a node on Vercel or Docker; each operator keeps sovereignty over their region.
5. **Sync** — Gossip deltas and signed inbox pushes spread verified facts between peer nodes in near real time.
6. **Build** — The protocol, SDK, and mesh APIs stay open so agencies, apps, and extensions can plug in freely.

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


| Component       | Path                | Description                                                                                 |
| --------------- | ------------------- | ------------------------------------------------------------------------------------------- |
| **Node**        | `apps/node`         | Next.js API + dashboard. Deploy on Vercel or Docker. Search, rich map, AI gap-fill cron.    |
| **Access**      | `apps/access`       | Mobile app for verified accessibility — browse, report issues, and on-site audits.          |
| **Lens**        | `apps/lens`         | Chrome MV3 extension. Listing-page hover tooltips + popup panel on Booking.com and Expedia. |
| **Agency Demo** | `apps/agency-demo`  | Static HTML demo showing three SDK integration patterns.                                    |
| **Core**        | `packages/core`     | Shared types, tier constants, gossip merge logic.                                           |
| **SDK**         | `packages/sdk`      | Browser SDK for travel agencies (CJS + ESM + UMD).                                          |
| **AI Agent**    | `packages/ai-agent` | GPT-4o vision analysis and text-based gap-filling engine.                                   |


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


| `GET /api/setup`                          | Returns whether first-run admin setup is required.                |
| `POST /api/setup`                         | Create the first admin account (username & password); returns a signed JWT |

---

## Quick Start

Full development guide: **[docs/LOCAL.md](docs/LOCAL.md)** (setup, OSM ingest, clients).

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

Or start the full production stack (`docker compose -f docker/docker-compose.yml up --build -d`) — Postgres is also reachable on `localhost:5432` for `pnpm db:setup`.

### 3. Database

```bash
pnpm db:setup               # reset DB + migrations + field definitions
```

This resets the local database and applies migrations. **OSM accommodation data is no longer auto-loaded** — after `pnpm dev`, complete `/setup`, then open **Admin** (`/stats`) → **Region & OSM ingest** to draw or pick a preset and confirm ingest.

On first start the node starts with an **empty map** until a region is configured. Large regions (countries, Benelux) take 1–2 hours to ingest — see [docs/LOCAL.md](docs/LOCAL.md#osm-ingest-local).

After running migrations and seeding, start the node (`pnpm dev`) and open the dashboard at `http://localhost:3000`.
If no admin exists the server will redirect you to `/setup` to create the initial administrator account. The server also logs a notice:

```
⚠️  No admin account found. Open the node web UI to complete first-time setup…
```

You can check whether setup is required via `GET /api/setup`, or create the first admin programmatically via `POST /api/setup` (accepts `username` and `password` and returns a signed JWT). Legacy `ADMIN_USERNAME`/`ADMIN_PASSWORD` env variables are no longer used; use the web UI or the setup API for first-run provisioning.

#### AI Provider Configuration

The node supports local OpenAI-compatible providers (for example Ollama or LM Studio) as well as OpenAI itself. Configure the node with these optional environment variables:

- `AI_API_KEY` — API key for your AI provider (preferred). If not set, `OPENAI_API_KEY` is used for OpenAI.
- `AI_BASE_URL` — Base URL for a local/remote provider (e.g. `http://localhost:11434` for Ollama).
- `AI_VISION_MODEL` — Name of the vision model to use for image analysis.
- `AI_TEXT_MODEL` — Name of the text model for gap-filling/completions.

Example `.env` snippet:

```env
# Optional AI config (local providers or OpenAI)
AI_API_KEY=your_api_key_here
AI_BASE_URL=http://localhost:11434/v1
AI_VISION_MODEL=your-vision-model
AI_TEXT_MODEL=your-text-model
# Backwards compatibility: OPENAI_API_KEY is still supported for OpenAI
# OPENAI_API_KEY=sk-...
```

### 4. Run the apps


| Terminal | Command                | URL                                                                                           |
| -------- | ---------------------- | --------------------------------------------------------------------------------------------- |
| 1        | `pnpm dev`             | [http://localhost:3000](http://localhost:3000) — node dashboard + API                         |
| 2        | `pnpm dev:access`      | [http://localhost:3001](http://localhost:3001) — WikiTraveler Access mobile app               |
| 3        | `pnpm dev:agency-demo` | [http://localhost:4000/apps/agency-demo/](http://localhost:4000/apps/agency-demo/) — SDK demo |


See [apps/README.md](apps/README.md) for step-by-step flow walkthroughs.

### Accessibility

WikiTraveler targets **WCAG 2.1 Level AA**. The public statement lives at `/accessibility` on each node. Developer checklist: [docs/ACCESSIBILITY.md](docs/ACCESSIBILITY.md). Formal report: [docs/CONFORMANCE.md](docs/CONFORMANCE.md). Run `pnpm test:a11y` and `pnpm lighthouse:ci` before merging UI changes.

---

## Run WikiTraveler

Pick the guide that matches your goal. Each includes a step-by-step plan and OSM region ingest instructions.


| Scenario              | When                                  | Guide                            |
| --------------------- | ------------------------------------- | -------------------------------- |
| **Local development** | Coding, first ingest, testing         | [docs/LOCAL.md](docs/LOCAL.md)   |
| **Docker production** | Self-hosted node (VPS, on-prem)       | [docs/DOCKER.md](docs/DOCKER.md) |
| **Vercel production** | Serverless node + WikiTraveler Access | [docs/VERCEL.md](docs/VERCEL.md) |


**OSM rule of thumb:** run the first large ingest (country or Benelux-scale) on **local dev or Docker**, then deploy to Vercel for maintenance cron refreshes.

---

## Monorepo Structure

```
wikitraveler/
├── apps/
│   ├── node/            # Next.js node (API + dashboard)
│   ├── access/          # Next.js mobile app (WikiTraveler Access)
│   ├── lens/            # Chrome MV3 extension
│   └── agency-demo/     # Static agency SDK demo
├── packages/
│   ├── core/            # Shared types & gossip merge logic
│   ├── sdk/             # Browser SDK (CJS + ESM + UMD)
│   └── ai-agent/        # GPT-4o vision + gap-fill engine
├── prisma/schema.prisma # Database schema (PostgreSQL)
├── docker/              # Dockerfiles + compose files
├── scripts/             # seed.ts, osm-ingest.ts, lighthouse helpers
└── .env.example         # Environment variable reference
```

---

## Scripts

### Apps


| Script                 | Description                            |
| ---------------------- | -------------------------------------- |
| `pnpm dev`             | Start node on :3000                    |
| `pnpm dev:access`      | Start WikiTraveler Access on :3001     |
| `pnpm dev:agency-demo` | Build SDK + serve agency demo on :4000 |
| `pnpm build`           | Build all packages and apps            |


### Database


| Script            | Description                                                                             |
| ----------------- | --------------------------------------------------------------------------------------- |
| `pnpm db:setup`   | **Local fresh start:** reset DB, run migrations, seed field definitions                 |
| `pnpm db:migrate` | Apply pending schema migrations (keep existing data)                                    |
| `pnpm db:seed`    | Re-ingest OSM fixture for the admin-configured bbox (offline; requires region in Admin) |


### Quality


| Script               | Description                                              |
| -------------------- | -------------------------------------------------------- |
| `pnpm test`          | Run unit tests (node + access)                           |
| `pnpm test:a11y`     | Accessibility regression tests (axe + map)               |
| `pnpm lighthouse:ci` | Lighthouse accessibility gate (≥ 90; needs running apps) |


### Maintainers


| Script                       | When you need it                                                                                                                                 |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm osm:ingest`            | Fetch Overpass data for the **admin-configured bbox** (reads DB; refresh fixtures)                                                               |
| `pnpm osm:import-pbf`        | Geofabrik PBF import (`--region france` or `--geojson file.geojsonseq`) — see [docs/LOCAL.md](docs/LOCAL.md) or [docs/DOCKER.md](docs/DOCKER.md) |
| `pnpm osm:import-pbf:docker` | Same as above, inside Docker dev container (Windows / no local osmium)                                                                           |
| `pnpm exec tsx scripts/geocode-missing-coords.ts` | Backfill lat/lon for properties missing coordinates (Nominatim; optional `--name`)                                                          |
| `pnpm db:migrate-photos`     | One-time upload of base64 photos to R2/Supabase — see [docs/VERCEL.md](docs/VERCEL.md) or [docs/DOCKER.md](docs/DOCKER.md)                       |
| `pnpm dev:gossip-lab`        | Docker: two nodes for peer gossip testing — see [docs/GOSSIP-DEV.md](docs/GOSSIP-DEV.md)                                                         |
| `pnpm gossip:check`          | Smoke-check gossip lab peer registration                                                                                                         |


---

## License

MIT. Data contributed to the mesh is released under CC-BY 4.0.