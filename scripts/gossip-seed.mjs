/**
 * Seed OSM baseline into both gossip-lab databases (host → published Postgres ports).
 *
 * Usage: pnpm gossip:seed
 * Requires: gossip lab postgres containers running (ports 5433 and 5434).
 */

import { spawnSync } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BBOX = process.env.OSM_BBOX ?? "51.39,5.42,51.49,5.52";

const NODES = [
  {
    label: "Node A",
    databaseUrl: process.env.NODE_A_DATABASE_URL
      ?? "postgresql://wikitraveler:wikitraveler@localhost:5433/wikitraveler",
    nodeId: "node-a",
  },
  {
    label: "Node B",
    databaseUrl: process.env.NODE_B_DATABASE_URL
      ?? "postgresql://wikitraveler:wikitraveler@localhost:5434/wikitraveler",
    nodeId: "node-b",
  },
];

function seedNode({ label, databaseUrl, nodeId }) {
  console.log(`\n🌱 ${label} (${databaseUrl.replace(/:[^:@/]+@/, ":****@")})`);
  const result = spawnSync(
    "pnpm",
    ["exec", "tsx", "scripts/seed.ts"],
    {
      cwd: ROOT,
      stdio: "inherit",
      shell: true,
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl,
        OSM_BBOX: BBOX,
        NODE_ID: nodeId,
        REQUIRE_OSM_FIXTURE: "true",
      },
    }
  );
  if (result.status !== 0) {
    throw new Error(`${label} seed failed`);
  }
}

async function main() {
  console.log("Seeding gossip lab databases from committed OSM fixture…");
  for (const node of NODES) {
    seedNode(node);
  }
  console.log("\nDone. Run pnpm gossip:check to verify property counts.");
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
