/**
 * Demonstrate property CRUD + metadata-override gossip across the lab nodes.
 *
 * Flow:
 *   1. Upsert a shared property on Node A (in-bbox so it survives gossip filtering).
 *   2. Edit name + coordinates on Node A — stored as manual metadata overrides.
 *   3. Pull gossip on Node B (B ← A).
 *   4. Show base vs effective metadata on both nodes (override should win on B).
 *   5. Reset one field on A, sync, and show the base value returns.
 *
 * Usage: pnpm gossip:crud
 */

const NODE_A = (process.env.NODE_A_URL ?? "http://localhost:3000").replace(/\/$/, "");
const NODE_B = (process.env.NODE_B_URL ?? "http://localhost:3010").replace(/\/$/, "");

const CANONICAL = process.env.GOSSIP_CRUD_CANONICAL ?? "lab:crud-demo";
// Inside the Eindhoven lab bbox (51.39,5.42 → 51.49,5.52)
const BASE = { lat: 51.438, lon: 5.479 };

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function jsonFetch(url, opts) {
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000), ...opts });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { message: text };
  }
  if (!res.ok) throw new Error(`${url} → ${res.status}: ${data.message ?? text}`);
  return data;
}

async function getProperty(base) {
  try {
    const data = await jsonFetch(`${base}/api/dev/property?canonicalId=${encodeURIComponent(CANONICAL)}`);
    return data.property;
  } catch {
    return null;
  }
}

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
  const data = await jsonFetch(`${NODE_B}/api/cron/gossip`);
  for (const r of data.results ?? []) {
    console.log(`    B pull ${r.url}: ${r.ok ? `ingested ${r.ingested ?? 0}` : r.error}`);
  }
}

async function main() {
  console.log("Gossip lab — property CRUD + override propagation\n");

  console.log("1. Upsert base property on Node A…");
  await jsonFetch(`${NODE_A}/api/dev/property`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      canonicalId: CANONICAL,
      name: "Lab CRUD Hotel",
      location: "Stratumseind 1, Eindhoven",
      lat: BASE.lat,
      lon: BASE.lon,
    }),
  });

  console.log("2. Edit name + coordinates on Node A (writes overrides + peer push)…");
  await jsonFetch(`${NODE_A}/api/dev/property`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      canonicalId: CANONICAL,
      name: "Lab CRUD Hotel (corrected on A)",
      lat: BASE.lat + 0.0005,
      lon: BASE.lon + 0.0005,
    }),
  });

  console.log("3. Pull gossip on Node B (B ← A)…");
  await syncB();
  await sleep(500);

  console.log("\n4. State after edit:");
  show("A", await getProperty(NODE_A));
  show("B", await getProperty(NODE_B));

  console.log("\n5. Reset name to base on Node A, then sync…");
  await jsonFetch(`${NODE_A}/api/dev/property`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ canonicalId: CANONICAL, resetFields: ["name"] }),
  });
  await syncB();
  await sleep(500);

  console.log("\n   State after reset:");
  show("A", await getProperty(NODE_A));
  show("B", await getProperty(NODE_B));

  console.log("\nDone. Re-run is idempotent. Delete the demo property with:");
  console.log(`  curl -X DELETE "${NODE_A}/api/dev/property?canonicalId=${CANONICAL}"`);
}

main().catch((err) => {
  console.error(err.message ?? err);
  console.error("\nIs the gossip lab running and linked?  pnpm dev:gossip-lab && pnpm gossip:link-peers");
  process.exit(1);
});
