/**
 * Tier B federation suite orchestrator (topology + resolve + CONFIRMED).
 *
 * Requires mesh-3 gossip lab:
 *   docker compose -f docker/docker-compose.gossip.yml \
 *     -f docker/docker-compose.gossip-mesh3.yml up --build
 *
 * Usage: pnpm gossip:tier-b
 * See docs/FEDERATION-E2E.md
 */

import { spawnSync } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const STEPS = [
  ["mesh-3", "scripts/gossip-mesh-3.mjs"],
  ["confirmed", "scripts/gossip-confirmed.mjs"],
  ["resolve", "scripts/gossip-resolve.mjs"],
];

function run(label, script) {
  console.log(`\n======== gossip:${label} ========\n`);
  const result = spawnSync(process.execPath, [script], {
    cwd: ROOT,
    stdio: "inherit",
    env: process.env,
  });
  if (result.status !== 0) {
    throw new Error(`gossip:${label} failed (exit ${result.status ?? "null"})`);
  }
}

async function main() {
  console.log("Gossip Tier B suite (mesh-3 + confirmed + resolve)\n");
  for (const [label, script] of STEPS) {
    run(label, join(ROOT, script));
  }
  console.log("\n✓ Gossip Tier B suite passed");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
