/**
 * Tier B: peer resolve quality (RFC-0002 M2 / H3).
 *
 * Home node A is given a non-containing bbox so self never wins for test points.
 * Peers B (wide) and C (small / equal-area) cover Eindhoven-ish geometry.
 *
 * Asserts:
 *   - Nested: point in Eindhoven → smallest peer (node-c)
 *   - Equal area: nearer center wins
 *   - Uncovered: far point → matched "fallback" (not a wrong peer)
 *
 * Requires mesh-3 lab. Usage: pnpm gossip:resolve
 */

import {
  NODE_A,
  NODE_B,
  NODE_C,
  PEER_A,
  PEER_B,
  PEER_C,
  waitForNode,
  waitForPeer,
  ensureAdminToken,
  linkPeer,
  setNodeRegion,
  dbUrlForNode,
  jsonFetch,
  cronGossip,
  sleep,
} from "./lib/gossip-lab.mjs";

const NESTED_POINT = { lat: 51.44, lon: 5.47 };
const EQUAL_POINT = { lat: 51.5, lon: 5.6 };
const UNCOVERED_POINT = { lat: 35.68, lon: 139.69 }; // Tokyo

async function resolve(base, token, { lat, lon }) {
  const { data } = await jsonFetch(
    `${base}/api/peers/resolve?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return data;
}

async function refreshPeerLinks() {
  // Refresh NodePeer.bbox from live nodeinfo after region changes
  await linkPeer(NODE_B, PEER_A);
  await linkPeer(NODE_B, PEER_C);
  await linkPeer(NODE_A, PEER_B);
  await linkPeer(NODE_C, PEER_B);
  await cronGossip(NODE_A);
  await sleep(500);
}

async function main() {
  console.log("Gossip peer-resolve E2E\n");

  await Promise.all([
    waitForNode(NODE_A, "Node A"),
    waitForNode(NODE_B, "Node B"),
    waitForNode(NODE_C, "Node C"),
  ]);
  await waitForPeer(NODE_A, "node-b", "Node A");
  await waitForPeer(NODE_B, "node-c", "Node B");

  const token = await ensureAdminToken(NODE_A);

  console.log("1. Nested bboxes — A outside, B wide, C small…");
  await setNodeRegion(dbUrlForNode("a"), {
    bbox: "48.80,2.20,48.90,2.40",
    label: "Paris lab home non-covering",
  });
  await setNodeRegion(dbUrlForNode("b"), {
    bbox: "50.0,3.0,54.0,8.0",
    label: "Wide Benelux",
  });
  await setNodeRegion(dbUrlForNode("c"), {
    bbox: "51.4,5.4,51.5,5.5",
    label: "Eindhoven small",
  });
  await refreshPeerLinks();

  // Ensure A knows C with bbox (transitive)
  await cronGossip(NODE_B);
  await cronGossip(NODE_A);
  await sleep(500);

  const nested = await resolve(NODE_A, token, NESTED_POINT);
  console.log(`  resolve(${NESTED_POINT.lat},${NESTED_POINT.lon}) →`, nested);
  if (nested.matched !== "peer" || nested.nodeId !== "node-c") {
    throw new Error(
      `Nested resolve expected peer node-c, got matched=${nested.matched} nodeId=${nested.nodeId}`
    );
  }
  console.log("✓ Smallest containing peer wins (node-c)");

  console.log("\n2. Equal-area tie-break — nearer center…");
  await setNodeRegion(dbUrlForNode("b"), {
    bbox: "51.0,5.0,52.0,5.5",
    label: "Equal-left",
  });
  await setNodeRegion(dbUrlForNode("c"), {
    bbox: "51.0,5.4,52.0,5.9",
    label: "equal-right",
  });
  await refreshPeerLinks();
  await cronGossip(NODE_B);
  await cronGossip(NODE_A);
  await sleep(500);

  const equal = await resolve(NODE_A, token, EQUAL_POINT);
  console.log(`  resolve(${EQUAL_POINT.lat},${EQUAL_POINT.lon}) →`, equal);
  if (equal.matched !== "peer" || equal.nodeId !== "node-c") {
    throw new Error(
      `Equal-area resolve expected nearer peer node-c, got matched=${equal.matched} nodeId=${equal.nodeId}`
    );
  }
  console.log("✓ Nearer bbox center wins (node-c)");

  console.log("\n3. Uncovered point → fallback (not a wrong peer)…");
  const uncovered = await resolve(NODE_A, token, UNCOVERED_POINT);
  console.log(`  resolve(${UNCOVERED_POINT.lat},${UNCOVERED_POINT.lon}) →`, uncovered);
  if (uncovered.matched !== "fallback") {
    throw new Error(`Uncovered expected matched=fallback, got ${uncovered.matched} (${uncovered.nodeId})`);
  }
  if (uncovered.nodeId !== "node-a") {
    throw new Error(`Uncovered fallback should be home node-a, got ${uncovered.nodeId}`);
  }
  console.log("✓ Uncovered → fallback home (not wrong peer)");

  console.log("\n✓ Gossip peer-resolve E2E passed");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  console.error("\nRequires mesh-3 lab with Postgres ports 5433/5434/5435 published.");
  process.exit(1);
});
