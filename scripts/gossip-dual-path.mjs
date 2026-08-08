/**
 * Dual-path federation E2E: inbox push + cron pull heal + idempotent re-pull.
 *
 * 1. Shared property on A and B (overrides require local property on receiver).
 * 2. PATCH override on A → B receives via push (no cron).
 * 3. DELETE property on B → cron pull restores property + override from A.
 * 4. Second cron pull leaves effective metadata unchanged (idempotent).
 *
 * Usage: pnpm gossip:dual-path
 */

import { loadGossipLabPrivateKey } from "./gossip-node-auth.mjs";
import {
  NODE_A,
  NODE_B,
  LAB_COORDS,
  waitForNode,
  waitForPeer,
  upsertProperty,
  patchProperty,
  deleteProperty,
  getProperty,
  cronGossip,
  pollUntil,
  sleep,
} from "./lib/gossip-lab.mjs";

const CANONICAL = process.env.GOSSIP_DUAL_CANONICAL ?? `lab:dual-path-${Date.now()}`;
const PUSH_NAME = "Dual-path Hotel (pushed)";
const BASE_NAME = "Dual-path Hotel";

async function main() {
  console.log("Gossip dual-path E2E (push + pull heal)\n");
  console.log(`canonicalId=${CANONICAL}\n`);

  await Promise.all([waitForNode(NODE_A, "Node A"), waitForNode(NODE_B, "Node B")]);
  // Ensure lab keys present (push requires NODE_PRIVATE_KEY in containers)
  loadGossipLabPrivateKey("node-a");
  loadGossipLabPrivateKey("node-b");

  await waitForPeer(NODE_A, "node-b", "Node A");
  await waitForPeer(NODE_B, "node-a", "Node B");

  console.log("\n1. Upsert base property on A and B…");
  const body = {
    canonicalId: CANONICAL,
    name: BASE_NAME,
    location: "Stratumseind 2, Eindhoven",
    lat: LAB_COORDS.lat,
    lon: LAB_COORDS.lon,
  };
  await upsertProperty(NODE_A, body);
  await upsertProperty(NODE_B, body);

  console.log("2. PATCH override on A (triggers inbox push)…");
  await patchProperty(NODE_A, {
    canonicalId: CANONICAL,
    name: PUSH_NAME,
  });

  console.log("3. Poll B for override via push (no cron)…");
  const pushed = await pollUntil(
    async () => {
      const p = await getProperty(NODE_B, CANONICAL);
      return p?.name === PUSH_NAME ? p : null;
    },
    { label: "B to receive push override", retries: 20, retryMs: 1_000 }
  );
  console.log(`✓ Push path: B effective name="${pushed.name}"`);

  console.log("\n4. DELETE property on B, then cron pull to heal…");
  await deleteProperty(NODE_B, CANONICAL);
  if (await getProperty(NODE_B, CANONICAL)) {
    throw new Error("Expected property deleted on B before pull heal");
  }

  const pull = await cronGossip(NODE_B);
  for (const r of pull.results ?? []) {
    console.log(`    B pull ${r.url}: ${r.ok ? `ingested ${r.ingested ?? 0}` : r.error}`);
  }
  await sleep(500);

  const healed = await pollUntil(
    async () => {
      const p = await getProperty(NODE_B, CANONICAL);
      return p?.name === PUSH_NAME ? p : null;
    },
    { label: "B pull heal", retries: 15, retryMs: 1_000 }
  );
  console.log(`✓ Pull path: B restored name="${healed.name}" (overrides=${healed.metadataOverrides?.length ?? 0})`);

  console.log("\n5. Second cron pull (idempotent)…");
  await cronGossip(NODE_B);
  await sleep(300);
  const again = await getProperty(NODE_B, CANONICAL);
  if (!again || again.name !== PUSH_NAME) {
    throw new Error(`Idempotent pull failed: expected "${PUSH_NAME}", got "${again?.name}"`);
  }
  console.log("✓ Second pull left effective metadata unchanged");

  // Cleanup (best-effort)
  await deleteProperty(NODE_A, CANONICAL).catch(() => {});
  await deleteProperty(NODE_B, CANONICAL).catch(() => {});

  console.log("\n✓ Gossip dual-path E2E passed");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
