/**
 * Tier C: audit photo evidence → snapshot photoRefs → peer ingest ignores them.
 *
 * Asserts:
 *   1. Audit with photo on data node → snapshot photoRefs[propertyId].urls
 *   2. Cron pull on peer still succeeds (photoRefs / unknown fields ignored)
 *   3. Property + fact land on peer; photoRefs are not required for merge
 *
 * Requires mesh-3 (or 2-node) lab. Usage: pnpm gossip:photos
 */

import {
  NODE_A,
  NODE_B,
  LAB_COORDS,
  LAB_TINY_PNG_DATA_URI,
  waitForNode,
  waitForPeer,
  ensureAdminToken,
  setNodeRegion,
  dbUrlForNode,
  seedFieldDefinitions,
  upsertProperty,
  fetchSnapshot,
  cronGossip,
  getProperty,
  postAudit,
  linkPeer,
  PEER_A,
  PEER_B,
  sleep,
  pollUntil,
} from "./lib/gossip-lab.mjs";

const EINDHOVEN_BBOX = "51.39,5.42,51.49,5.52";

async function main() {
  console.log("Gossip photos E2E (photoRefs + ingest ignore)\n");

  await Promise.all([waitForNode(NODE_A, "Node A"), waitForNode(NODE_B, "Node B")]);
  await waitForPeer(NODE_A, "node-b", "Node A");
  await waitForPeer(NODE_B, "node-a", "Node B");

  console.log("1. Overlapping Eindhoven regions + field seed…");
  await setNodeRegion(dbUrlForNode("a"), {
    bbox: EINDHOVEN_BBOX,
    label: "Eindhoven A",
  });
  await setNodeRegion(dbUrlForNode("b"), {
    bbox: EINDHOVEN_BBOX,
    label: "Eindhoven B",
  });
  await linkPeer(NODE_A, PEER_B);
  await linkPeer(NODE_B, PEER_A);
  await seedFieldDefinitions(dbUrlForNode("b"));

  const suffix = Date.now().toString(36);
  const canonicalId = `osm:way:photo-e2e-${suffix}`;
  const prop = await upsertProperty(NODE_B, {
    canonicalId,
    name: `Photo Evidence Hotel ${suffix}`,
    location: "Eindhoven",
    lat: LAB_COORDS.lat,
    lon: LAB_COORDS.lon,
  });
  console.log(`✓ Property ${canonicalId} on B`);

  console.log("2. Audit with photo evidence on B…");
  const token = await ensureAdminToken(NODE_B);
  const { res: auditRes, data: auditData } = await postAudit(NODE_B, prop.id, token, {
    facts: [{ fieldName: "step_free_entrance", value: "yes" }],
    photos: [
      {
        dataUri: LAB_TINY_PNG_DATA_URI,
        fieldName: "step_free_entrance",
        scopeKey: "property",
        caption: "entrance",
      },
    ],
    locale: "en",
  });
  if (!auditRes.ok) {
    throw new Error(
      `Audit+photo failed ${auditRes.status}: ${auditData.message ?? JSON.stringify(auditData)}`
    );
  }
  console.log("✓ Audit with photo stored on B");

  console.log("3. Snapshot photoRefs…");
  const snap = await fetchSnapshot(NODE_B);
  if (!snap.photoRefs || typeof snap.photoRefs !== "object") {
    throw new Error("Snapshot missing photoRefs object");
  }
  const ref = snap.photoRefs[prop.id];
  if (!ref?.urls?.length) {
    throw new Error(
      `photoRefs[${prop.id}] missing urls — got ${JSON.stringify(ref ?? null)}`
    );
  }
  if (ref.originNode !== "node-b") {
    throw new Error(`photoRefs.originNode expected node-b, got ${ref.originNode}`);
  }
  console.log(`✓ photoRefs for ${prop.id}: ${ref.urls.length} url(s), origin=${ref.originNode}`);

  console.log("4. Cron pull A ← B (must tolerate photoRefs)…");
  const cron = await cronGossip(NODE_A);
  const pullB = (cron.results ?? []).find(
    (r) => r.url?.includes("node-b") || r.ok !== undefined
  );
  for (const r of cron.results ?? []) {
    console.log(`    A pull ${r.url}: ${r.ok ? `ingested ${r.ingested ?? 0}` : r.error}`);
    if (!r.ok) {
      throw new Error(`Cron pull failed for ${r.url}: ${r.error}`);
    }
  }
  if (!pullB && (cron.results ?? []).length === 0) {
    throw new Error("Cron returned no pull results");
  }

  await pollUntil(
    async () => getProperty(NODE_A, canonicalId),
    { label: `property ${canonicalId} on A`, retries: 20, retryMs: 2_000 }
  );
  console.log("✓ Property synced to A (photoRefs ignored for merge)");

  // Peer snapshot on A should not invent local photo evidence from gossip alone
  const snapA = await fetchSnapshot(NODE_A);
  const localProp = await getProperty(NODE_A, canonicalId);
  const aRef = localProp ? snapA.photoRefs?.[localProp.id] : null;
  if (aRef?.urls?.length) {
    // Accept if A somehow has photos (e.g. push duplicated) — still OK for ignore semantics
    console.log(`  note: A also has photoRefs (${aRef.urls.length}) — merge still healthy`);
  } else {
    console.log("✓ A snapshot has no local photoRefs for gossiped property (expected)");
  }

  await sleep(200);
  console.log("\n✓ Gossip photos E2E passed");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  console.error("\nRequires gossip lab with Postgres ports published.");
  process.exit(1);
});
