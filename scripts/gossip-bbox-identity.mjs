/**
 * Bbox filter + canonical identity E2E.
 *
 * 1. Out-of-bbox property on A with override must not appear on B after cron pull.
 * 2. Same canonicalId on A and B with different local UUIDs: override push applies on B.
 *
 * Usage: pnpm gossip:bbox-identity
 */

import {
  NODE_A,
  NODE_B,
  LAB_COORDS,
  OUT_OF_BBOX_COORDS,
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

const OUT_CANONICAL = process.env.GOSSIP_BBOX_OUT_CANONICAL ?? `lab:bbox-out-${Date.now()}`;
const ID_CANONICAL = process.env.GOSSIP_BBOX_ID_CANONICAL ?? `lab:bbox-id-${Date.now()}`;

async function main() {
  console.log("Gossip bbox + identity E2E\n");

  await Promise.all([waitForNode(NODE_A, "Node A"), waitForNode(NODE_B, "Node B")]);
  await waitForPeer(NODE_A, "node-b", "Node A");
  await waitForPeer(NODE_B, "node-a", "Node B");

  // --- Out of bbox ---
  console.log(`1. Upsert out-of-bbox property on A only (${OUT_CANONICAL})…`);
  await upsertProperty(NODE_A, {
    canonicalId: OUT_CANONICAL,
    name: "Amsterdam Lab Hotel",
    location: "Damrak 1, Amsterdam",
    lat: OUT_OF_BBOX_COORDS.lat,
    lon: OUT_OF_BBOX_COORDS.lon,
  });
  await patchProperty(NODE_A, {
    canonicalId: OUT_CANONICAL,
    name: "Amsterdam Lab Hotel (edited)",
  });

  console.log("2. Cron pull on B — out-of-bbox must stay absent…");
  await cronGossip(NODE_B);
  await sleep(500);
  const leaked = await getProperty(NODE_B, OUT_CANONICAL);
  if (leaked) {
    throw new Error(`Out-of-bbox property leaked to B: ${OUT_CANONICAL}`);
  }
  console.log("✓ B did not ingest out-of-bbox property/override");

  // --- Canonical identity ---
  console.log(`\n3. Same canonicalId, local upserts on A and B (${ID_CANONICAL})…`);
  const aProp = await upsertProperty(NODE_A, {
    canonicalId: ID_CANONICAL,
    name: "Identity Hotel",
    location: "Stratumseind 3, Eindhoven",
    lat: LAB_COORDS.lat + 0.001,
    lon: LAB_COORDS.lon + 0.001,
  });
  const bProp = await upsertProperty(NODE_B, {
    canonicalId: ID_CANONICAL,
    name: "Identity Hotel",
    location: "Stratumseind 3, Eindhoven",
    lat: LAB_COORDS.lat + 0.001,
    lon: LAB_COORDS.lon + 0.001,
  });
  if (aProp.id === bProp.id) {
    console.log("  (note: local UUIDs happened to match — still valid)");
  } else {
    console.log(`  A.id=${aProp.id.slice(0, 8)}… B.id=${bProp.id.slice(0, 8)}… (distinct local IDs)`);
  }

  const corrected = "Identity Hotel (canonical remap)";
  await patchProperty(NODE_A, { canonicalId: ID_CANONICAL, name: corrected });

  const remapped = await pollUntil(
    async () => {
      const p = await getProperty(NODE_B, ID_CANONICAL);
      return p?.name === corrected ? p : null;
    },
    { label: "canonical remap via push", retries: 20, retryMs: 1_000 }
  );
  if (remapped.id !== bProp.id) {
    throw new Error("B property id changed unexpectedly after override push");
  }
  console.log(`✓ Override applied on B by canonicalId (local id preserved)`);

  await deleteProperty(NODE_A, OUT_CANONICAL).catch(() => {});
  await deleteProperty(NODE_A, ID_CANONICAL).catch(() => {});
  await deleteProperty(NODE_B, ID_CANONICAL).catch(() => {});

  console.log("\n✓ Gossip bbox + identity E2E passed");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
