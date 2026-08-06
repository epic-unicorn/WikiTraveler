/**
 * Property CRUD + metadata-override gossip across the lab nodes.
 *
 * Flow:
 *   1. Upsert a shared property on Node A (in-bbox so it survives gossip filtering).
 *   2. Edit name + coordinates on Node A — stored as manual metadata overrides.
 *   3. Pull gossip on Node B (B ← A) — also accepts inbox push if it already landed.
 *   4. Assert effective metadata on B matches the override.
 *   5. Reset name on A, sync, assert base name returns on B.
 *
 * Usage: pnpm gossip:crud
 */

import {
  NODE_A,
  NODE_B,
  LAB_COORDS,
  waitForNode,
  waitForPeer,
  upsertProperty,
  patchProperty,
  getProperty,
  cronGossip,
  pollUntil,
  sleep,
} from "./lib/gossip-lab.mjs";

const CANONICAL = process.env.GOSSIP_CRUD_CANONICAL ?? "lab:crud-demo";
const BASE = LAB_COORDS;
const EDITED_NAME = "Lab CRUD Hotel (corrected on A)";
const BASE_NAME = "Lab CRUD Hotel";

function show(label, p) {
  if (!p) {
    console.log(`  ${label}: (not present)`);
    return;
  }
  console.log(
    `  ${label}: effective="${p.name}" @ ${p.lat},${p.lon}  | base="${p.baseMetadata.name}" @ ${p.baseMetadata.lat},${p.baseMetadata.lon}  | overrides=${p.metadataOverrides.length}`
  );
}

async function syncB() {
  const data = await cronGossip(NODE_B);
  for (const r of data.results ?? []) {
    console.log(`    B pull ${r.url}: ${r.ok ? `ingested ${r.ingested ?? 0}` : r.error}`);
  }
}

async function main() {
  console.log("Gossip lab — property CRUD + override propagation\n");

  await Promise.all([waitForNode(NODE_A, "Node A"), waitForNode(NODE_B, "Node B")]);
  await waitForPeer(NODE_A, "node-b", "Node A");
  await waitForPeer(NODE_B, "node-a", "Node B");

  console.log("1. Upsert base property on Node A…");
  await upsertProperty(NODE_A, {
    canonicalId: CANONICAL,
    name: BASE_NAME,
    location: "Stratumseind 1, Eindhoven",
    lat: BASE.lat,
    lon: BASE.lon,
  });

  console.log("2. Edit name + coordinates on Node A (writes overrides + peer push)…");
  await patchProperty(NODE_A, {
    canonicalId: CANONICAL,
    name: EDITED_NAME,
    lat: BASE.lat + 0.0005,
    lon: BASE.lon + 0.0005,
  });

  console.log("3. Pull gossip on Node B (B ← A)…");
  await syncB();
  await sleep(500);

  console.log("\n4. State after edit:");
  const aAfterEdit = await getProperty(NODE_A, CANONICAL);
  const bAfterEdit = await pollUntil(
    async () => {
      const p = await getProperty(NODE_B, CANONICAL);
      return p?.name === EDITED_NAME ? p : null;
    },
    { label: "B effective override after edit", retries: 20, retryMs: 1_000 }
  );
  show("A", aAfterEdit);
  show("B", bAfterEdit);

  if (aAfterEdit?.name !== EDITED_NAME) {
    throw new Error(`A expected effective name "${EDITED_NAME}", got "${aAfterEdit?.name}"`);
  }
  if ((bAfterEdit.metadataOverrides?.length ?? 0) < 1) {
    throw new Error("B expected at least one metadata override after sync");
  }
  console.log("✓ Override propagated to B");

  console.log("\n5. Reset name to base on Node A, then sync…");
  await patchProperty(NODE_A, {
    canonicalId: CANONICAL,
    resetFields: ["name"],
  });
  await syncB();
  await sleep(500);

  const aAfterReset = await getProperty(NODE_A, CANONICAL);
  const bAfterReset = await pollUntil(
    async () => {
      const p = await getProperty(NODE_B, CANONICAL);
      return p?.name === BASE_NAME ? p : null;
    },
    { label: "B name reset to base", retries: 20, retryMs: 1_000 }
  );

  console.log("\n   State after reset:");
  show("A", aAfterReset);
  show("B", bAfterReset);

  if (aAfterReset?.name !== BASE_NAME || bAfterReset?.name !== BASE_NAME) {
    throw new Error(
      `Reset failed: A="${aAfterReset?.name}" B="${bAfterReset?.name}" (expected "${BASE_NAME}")`
    );
  }
  console.log("✓ Name reset to base on A and B");

  console.log("\n✓ Gossip CRUD E2E passed");
  console.log(`Delete the demo property with:`);
  console.log(`  curl -X DELETE "${NODE_A}/api/dev/property?canonicalId=${CANONICAL}"`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  console.error("\nIs the gossip lab running and linked?  pnpm dev:gossip-lab && pnpm gossip:discovery");
  process.exit(1);
});
