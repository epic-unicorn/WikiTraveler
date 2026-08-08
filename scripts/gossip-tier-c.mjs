/**
 * Tier C federation suite orchestrator (hub journey + photos + Lens Origin).
 *
 * Requires mesh-3 gossip lab:
 *   docker compose -f docker/docker-compose.gossip.yml \
 *     -f docker/docker-compose.gossip-mesh3.yml up --build
 *
 * Usage: pnpm gossip:tier-c
 * See docs/FEDERATION-E2E.md
 */

import { spawnSync } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const STEPS = [
  ["hub-journey", "scripts/gossip-hub-journey.mjs"],
  ["photos", "scripts/gossip-photos.mjs"],
  ["lens-smoke", "scripts/gossip-lens-smoke.mjs"],
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
  console.log("Gossip Tier C suite (hub-journey + photos + lens-smoke)\n");
  for (const [label, script] of STEPS) {
    run(label, join(ROOT, script));
  }
  console.log("\n✓ Gossip Tier C suite passed");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
