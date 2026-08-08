/**
 * Tier A federation hardening orchestrator for CI and local runs.
 *
 * Runs (in order):
 *   dual-path → auth-negative → bbox-identity → crud → reingest
 *
 * Usage (gossip lab must be running; prefer after gossip:discovery or seed):
 *   pnpm gossip:hardening
 *
 * See docs/FEDERATION-E2E.md
 */

import { spawnSync } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const STEPS = [
  ["dual-path", "scripts/gossip-dual-path.mjs"],
  ["auth-negative", "scripts/gossip-auth-negative.mjs"],
  ["bbox-identity", "scripts/gossip-bbox-identity.mjs"],
  ["crud", "scripts/gossip-crud.mjs"],
  ["reingest", "scripts/gossip-reingest.mjs"],
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
  console.log("Gossip hardening suite (Tier A)\n");
  for (const [label, script] of STEPS) {
    run(label, join(ROOT, script));
  }
  console.log("\n✓ Gossip hardening suite passed");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
