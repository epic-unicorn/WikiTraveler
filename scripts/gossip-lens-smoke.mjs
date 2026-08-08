/**
 * Tier C: Lens-style Origin smoke (chrome-extension:// allowlist).
 *
 * Asserts home login/resolve and data-node map/facts accept LAB_LENS_ORIGIN
 * via CLIENT_ORIGINS (mesh-3 overlay).
 *
 * Usage: pnpm gossip:lens-smoke
 */

import {
  NODE_A,
  NODE_B,
  NODE_C,
  PEER_A,
  PEER_B,
  PEER_C,
  LAB_COORDS,
  LAB_LENS_ORIGIN,
  waitForNode,
  waitForPeer,
  ensureAdminToken,
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
  sleep,
} from "./lib/gossip-lab.mjs";

const EINDHOVEN_BBOX = "51.39,5.42,51.49,5.52";
const MAP_BBOX = "51.40,5.45,51.47,5.50";

async function main() {
  console.log("Gossip Lens Origin smoke E2E\n");

  await Promise.all([
    waitForNode(NODE_A, "Node A"),
    waitForNode(NODE_B, "Node B"),
    waitForNode(NODE_C, "Node C"),
  ]);
  await waitForPeer(NODE_A, "node-b", "Node A");

  console.log("1. Regions + property on B…");
  await setNodeRegion(dbUrlForNode("a"), {
    bbox: "48.80,2.20,48.90,2.40",
    label: "Paris lab home non-covering",
  });
  await setNodeRegion(dbUrlForNode("b"), {
    bbox: EINDHOVEN_BBOX,
    label: "Eindhoven data",
  });
  await linkPeer(NODE_B, PEER_A);
  await linkPeer(NODE_A, PEER_B);
  await linkPeer(NODE_B, PEER_C);
  await linkPeer(NODE_C, PEER_B);
  await cronGossip(NODE_B);
  await cronGossip(NODE_A);
  await sleep(500);

  await seedFieldDefinitions(dbUrlForNode("b"));
  const suffix = Date.now().toString(36);
  const prop = await upsertProperty(NODE_B, {
    canonicalId: `osm:way:lens-smoke-${suffix}`,
    name: `Lens Smoke Cafe ${suffix}`,
    location: "Eindhoven",
    lat: LAB_COORDS.lat,
    lon: LAB_COORDS.lon,
  });

  console.log("2. CLIENT_ORIGINS allows Lens extension Origin…");
  await assertCors(NODE_A, LAB_LENS_ORIGIN, { expectAllow: true });
  await assertCors(NODE_B, LAB_LENS_ORIGIN, { expectAllow: true });

  console.log("3. Home login + resolve with Lens Origin…");
  await ensureAdminToken(NODE_A);
  const { token } = await ensureLabAuditor(NODE_A, {
    username: `lensuser-${suffix}`,
  });

  const { res: resolveRes, data: resolved } = await jsonFetch(
    `${NODE_A}/api/peers/resolve?lat=${LAB_COORDS.lat}&lon=${LAB_COORDS.lon}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Origin: LAB_LENS_ORIGIN,
      },
    }
  );
  const resolveAcao = resolveRes.headers.get("access-control-allow-origin");
  if (resolveAcao !== LAB_LENS_ORIGIN && resolveAcao !== "*") {
    throw new Error(`resolve ACAO expected ${LAB_LENS_ORIGIN}, got ${resolveAcao ?? "none"}`);
  }
  if (resolved.matched !== "peer" || resolved.nodeId !== "node-b") {
    throw new Error(
      `resolve expected peer node-b, got matched=${resolved.matched} nodeId=${resolved.nodeId}`
    );
  }
  const dataBase = hostUrlForPeer(resolved.url);
  console.log(`✓ Resolve with Lens Origin → ${dataBase} (ACAO=${resolveAcao})`);

  console.log("4. Data-node map + facts with Lens Origin…");
  const { res: mapRes, data: mapData } = await jsonFetch(
    `${dataBase}/api/properties/map?bbox=${encodeURIComponent(MAP_BBOX)}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Origin: LAB_LENS_ORIGIN,
      },
    }
  );
  const mapAcao = mapRes.headers.get("access-control-allow-origin");
  if (mapAcao !== LAB_LENS_ORIGIN && mapAcao !== "*") {
    throw new Error(`map ACAO expected ${LAB_LENS_ORIGIN}, got ${mapAcao ?? "none"}`);
  }
  const pins = mapData.pins ?? mapData.properties ?? [];
  if (!pins.some((p) => p.id === prop.id)) {
    throw new Error(`Lens map missing property id=${prop.id}`);
  }

  const { res: factsRes } = await jsonFetch(
    `${dataBase}/api/properties/${encodeURIComponent(prop.id)}/accessibility?locale=en`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Origin: LAB_LENS_ORIGIN,
      },
    }
  );
  const factsAcao = factsRes.headers.get("access-control-allow-origin");
  if (factsAcao !== LAB_LENS_ORIGIN && factsAcao !== "*") {
    throw new Error(`facts ACAO expected ${LAB_LENS_ORIGIN}, got ${factsAcao ?? "none"}`);
  }
  console.log(`✓ Data map + facts with Lens Origin (ACAO=${mapAcao})`);

  console.log("\n✓ Gossip Lens Origin smoke passed");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  console.error(
    "\nRequires mesh-3 with CLIENT_ORIGINS including chrome-extension://wikitraveler-lab-lens"
  );
  process.exit(1);
});
