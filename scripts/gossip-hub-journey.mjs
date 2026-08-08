/**
 * Tier C: API-scripted hub Access journey (RFC-0002 home vs data).
 *
 * Asserts:
 *   1. Login / register on home A (non-covering) → JWT
 *   2. Resolve Eindhoven → data peer B
 *   3. map?bbox= on B with home JWT + trusted Origin
 *   4. Audit on B with home JWT (federated RS256 via /.well-known/pubkey)
 *   5. H1 — untrusted Origin not reflected on B
 *   6. H5 — map without bbox → BBOX_REQUIRED
 *
 * Requires mesh-3 lab (GOSSIP_DEV rewrites host NODE_URL → docker DNS for JWT pubkey).
 * Usage: pnpm gossip:hub-journey
 */

import {
  NODE_A,
  NODE_B,
  NODE_C,
  PEER_A,
  PEER_B,
  PEER_C,
  LAB_COORDS,
  LAB_TRUSTED_ORIGIN,
  LAB_EVIL_ORIGIN,
  waitForNode,
  waitForPeer,
  ensureLabAuditor,
  linkPeer,
  setNodeRegion,
  dbUrlForNode,
  seedFieldDefinitions,
  upsertProperty,
  jsonFetch,
  cronGossip,
  assertCors,
  hostUrlForPeer,
  postAudit,
  sleep,
} from "./lib/gossip-lab.mjs";

const EINDHOVEN_BBOX = "51.39,5.42,51.49,5.52";
const MAP_BBOX = "51.40,5.45,51.47,5.50";

async function refreshPeerLinks() {
  await linkPeer(NODE_B, PEER_A);
  await linkPeer(NODE_B, PEER_C);
  await linkPeer(NODE_A, PEER_B);
  await linkPeer(NODE_C, PEER_B);
  await cronGossip(NODE_A);
  await sleep(500);
}

async function main() {
  console.log("Gossip hub-journey E2E (home A → data B)\n");

  await Promise.all([
    waitForNode(NODE_A, "Node A"),
    waitForNode(NODE_B, "Node B"),
    waitForNode(NODE_C, "Node C"),
  ]);
  await waitForPeer(NODE_A, "node-b", "Node A");
  await waitForPeer(NODE_B, "node-a", "Node B");

  console.log("1. Regions — A non-covering, B covers Eindhoven…");
  await setNodeRegion(dbUrlForNode("a"), {
    bbox: "48.80,2.20,48.90,2.40",
    label: "Paris lab home non-covering",
  });
  await setNodeRegion(dbUrlForNode("b"), {
    bbox: EINDHOVEN_BBOX,
    label: "Eindhoven data",
  });
  await refreshPeerLinks();
  await cronGossip(NODE_B);
  await cronGossip(NODE_A);
  await sleep(500);

  console.log("2. Seed field catalogue + property on data node B…");
  await seedFieldDefinitions(dbUrlForNode("b"));
  const suffix = Date.now().toString(36);
  const prop = await upsertProperty(NODE_B, {
    canonicalId: `osm:way:hub-journey-${suffix}`,
    name: `Hub Journey Hotel ${suffix}`,
    location: "Eindhoven",
    lat: LAB_COORDS.lat,
    lon: LAB_COORDS.lon,
  });
  console.log(`✓ Property ${prop.canonicalId} on B (id=${prop.id})`);

  console.log("3. Home A — register traveler, promote AUDITOR, login…");
  const { token: homeJwt, username } = await ensureLabAuditor(NODE_A, {
    username: `hubtraveler-${suffix}`,
  });
  const { data: me } = await jsonFetch(`${NODE_A}/api/auth/me`, {
    headers: { Authorization: `Bearer ${homeJwt}` },
  });
  if (!me?.homeNodeUrl) {
    throw new Error("homeNodeUrl missing from JWT /auth/me");
  }
  // Host-facing NODE_URL (localhost:3000) is rewritten to node-a inside Docker for pubkey fetch
  const home = String(me.homeNodeUrl);
  if (!/node-a|localhost:3000|127\.0\.0\.1:3000/i.test(home)) {
    throw new Error(`Unexpected homeNodeUrl for Node A: ${home}`);
  }
  console.log(`✓ Home JWT for ${username} (homeNodeUrl=${home})`);

  console.log("4. Resolve Eindhoven from home A → data peer…");
  const { data: resolved } = await jsonFetch(
    `${NODE_A}/api/peers/resolve?lat=${LAB_COORDS.lat}&lon=${LAB_COORDS.lon}`,
    { headers: { Authorization: `Bearer ${homeJwt}` } }
  );
  console.log("  resolve →", resolved);
  if (resolved.matched !== "peer" || resolved.nodeId !== "node-b") {
    throw new Error(
      `Expected resolve → peer node-b, got matched=${resolved.matched} nodeId=${resolved.nodeId}`
    );
  }
  const dataBase = hostUrlForPeer(resolved.url);
  if (dataBase !== NODE_B) {
    throw new Error(`Expected host data URL ${NODE_B}, got ${dataBase} (peer ${resolved.url})`);
  }
  console.log(`✓ Resolved data node B → ${dataBase}`);

  console.log("5. H1 CORS on data node…");
  await assertCors(NODE_B, LAB_TRUSTED_ORIGIN, { expectAllow: true });
  await assertCors(NODE_B, LAB_EVIL_ORIGIN, { expectAllow: false });

  console.log("6. map?bbox= on B with home JWT + trusted Origin…");
  const { res: mapRes, data: mapData } = await jsonFetch(
    `${NODE_B}/api/properties/map?bbox=${encodeURIComponent(MAP_BBOX)}`,
    {
      headers: {
        Authorization: `Bearer ${homeJwt}`,
        Origin: LAB_TRUSTED_ORIGIN,
      },
    }
  );
  const acao = mapRes.headers.get("access-control-allow-origin");
  if (acao !== LAB_TRUSTED_ORIGIN && acao !== "*") {
    throw new Error(`map ACAO expected ${LAB_TRUSTED_ORIGIN}, got ${acao ?? "none"}`);
  }
  const pins = mapData.pins ?? mapData.properties ?? [];
  const found = pins.some((p) => p.id === prop.id);
  if (!found) {
    throw new Error(
      `map bbox did not include property id=${prop.id} (got ${pins.length} pins)`
    );
  }
  console.log(`✓ Map returned property (${pins.length} pins, ACAO=${acao})`);

  console.log("7. H5 — map without bbox → BBOX_REQUIRED…");
  const { res: noBboxRes, data: noBbox } = await jsonFetch(
    `${NODE_B}/api/properties/map`,
    {
      headers: { Authorization: `Bearer ${homeJwt}` },
      expectOk: false,
    }
  );
  if (noBboxRes.status !== 400 || noBbox.code !== "BBOX_REQUIRED") {
    throw new Error(
      `Expected 400 BBOX_REQUIRED, got ${noBboxRes.status} ${noBbox.code ?? noBbox.message}`
    );
  }
  console.log("✓ Unscoped map rejected (BBOX_REQUIRED)");

  console.log("8. Audit on data B with home JWT…");
  // Warm federated pubkey path (B → A/.well-known/pubkey via docker DNS)
  const { res: auditRes, data: auditData } = await postAudit(
    NODE_B,
    prop.id,
    homeJwt,
    {
      facts: [{ fieldName: "step_free_entrance", value: "yes" }],
      locale: "en",
    },
    { origin: LAB_TRUSTED_ORIGIN }
  );
  if (!auditRes.ok) {
    throw new Error(
      `Federated audit failed ${auditRes.status}: ${auditData.message ?? JSON.stringify(auditData)}`
    );
  }
  console.log("✓ Home JWT accepted for audit on data node B");

  const { data: factsPayload } = await jsonFetch(
    `${NODE_B}/api/properties/${encodeURIComponent(prop.id)}/accessibility?locale=en`,
    { headers: { Authorization: `Bearer ${homeJwt}` } }
  );
  const facts = factsPayload.facts ?? factsPayload ?? [];
  const list = Array.isArray(facts) ? facts : [];
  const stepFree = list.find((f) => f.fieldName === "step_free_entrance");
  if (!stepFree || String(stepFree.value).toLowerCase() !== "yes") {
    throw new Error(
      `Expected step_free_entrance=yes on B, got ${JSON.stringify(stepFree ?? null)}`
    );
  }
  const submitted = stepFree.submittedBy ?? "";
  if (!submitted.includes(username)) {
    throw new Error(`submittedBy should include ${username}, got ${submitted}`);
  }
  console.log(`✓ Fact on B (submittedBy=${submitted})`);

  console.log("\n✓ Gossip hub-journey E2E passed");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  console.error("\nRequires mesh-3 lab with GOSSIP_DEV peer URL rewrite for federated JWT.");
  process.exit(1);
});
