/**
 * Seed OSM baseline into both gossip-lab databases (host → published Postgres ports).
 *
 * Usage: pnpm gossip:seed
 * Requires: region configured in Admin on each node (preset: Eindhoven lab).
 *           Postgres containers running (ports 5433 and 5434).
 */

import { spawnSync } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

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

// Optional third lab node (mesh-3 overlay — Postgres on :5435)
if (process.env.GOSSIP_MESH3 === "1" || process.env.NODE_C_DATABASE_URL) {
  NODES.push({
    label: "Node C",
    databaseUrl: process.env.NODE_C_DATABASE_URL
      ?? "postgresql://wikitraveler:wikitraveler@localhost:5435/wikitraveler",
    nodeId: "node-c",
  });
}

function seedNode({ label, databaseUrl, nodeId }) {
  console.log(`\n🌱 ${label} (${databaseUrl.replace(/:[^:@/]+@/, ":****@")})`);
  const result = spawnSync(
    "pnpm",
    ["exec", "tsx", "--tsconfig", "apps/node/tsconfig.json", "scripts/seed.ts"],
    {
      cwd: ROOT,
      stdio: "inherit",
      shell: true,
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl,
        NODE_ID: nodeId,
      },
    }
  );
  if (result.status !== 0) {
    throw new Error(`${label} seed failed`);
  }
}

async function main() {
  console.log("Seeding gossip lab databases from committed OSM fixture…");
  console.log("Ensure each node has region configured in Admin (preset: Eindhoven lab).\n");
  for (const node of NODES) {
    seedNode(node);
  }
  console.log("\nDone. Run pnpm gossip:check to verify property counts.");
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
