/**
 * Re-run OSM ingest on both lab nodes and confirm manual metadata overrides
 * survive the refresh.
 *
 * Flow:
 *   1. Read override counts before re-ingest.
 *   2. Trigger /api/dev/reingest on Node A and Node B (uses committed fixture).
 *   3. Read override counts after and confirm they are preserved.
 *
 * Usage: pnpm gossip:reingest
 *   GOSSIP_REINGEST_LIVE=1   allow live Overpass fetch if no fixture is present
 */

const NODE_A = (process.env.NODE_A_URL ?? "http://localhost:3000").replace(/\/$/, "");
const NODE_B = (process.env.NODE_B_URL ?? "http://localhost:3010").replace(/\/$/, "");
const LIVE = process.env.GOSSIP_REINGEST_LIVE === "1" ? "?live=1" : "";

async function jsonFetch(url, opts) {
  const res = await fetch(url, { signal: AbortSignal.timeout(120_000), ...opts });
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

async function stats(base) {
  return jsonFetch(`${base}/api/dev/gossip-stats`);
}

async function reingest(base, label) {
  console.log(`\n${label}: re-ingesting…`);
  const data = await jsonFetch(`${base}/api/dev/reingest${LIVE}`, { method: "POST" });
  console.log(
    `  bbox=${data.bbox} elements=${data.elements} created=${data.stats.created} updated=${data.stats.updated} ` +
      `properties=${data.propertyCount} overrides=${data.overrideCount} preserved=${data.overridesPreserved ? "yes" : "NO"}`
  );
  return data;
}

async function main() {
  console.log("Gossip lab — OSM re-ingest (overrides must survive)\n");

  const [aBefore, bBefore] = await Promise.all([stats(NODE_A), stats(NODE_B)]);
  console.log(`Before: A overrides=${aBefore.overrideCount ?? 0}, B overrides=${bBefore.overrideCount ?? 0}`);

  const a = await reingest(NODE_A, "Node A");
  const b = await reingest(NODE_B, "Node B");

  const aOk = a.overrideCount >= (aBefore.overrideCount ?? 0) && a.overridesPreserved;
  const bOk = b.overrideCount >= (bBefore.overrideCount ?? 0) && b.overridesPreserved;

  console.log(`\nOverrides preserved — A: ${aOk ? "yes" : "NO"}, B: ${bOk ? "yes" : "NO"}`);
  if (!aOk || !bOk) process.exitCode = 1;
  console.log("\nTip: run pnpm gossip:crud first to create an override, then re-run this.");
}

main().catch((err) => {
  console.error(err.message ?? err);
  console.error("\nIs the gossip lab running?  pnpm dev:gossip-lab");
  process.exit(1);
});
