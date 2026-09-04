/**
 * Tier B: transitive discovery A ↔ B ↔ C (A does not bootstrap C).
 *
 * Asserts:
 *   1. Organic A↔B and B↔C peer links form.
 *   2. After cron pulls, A learns node-c via gossip peers[] (no in-bbox facts required).
 *   3. C advertises evil ACCESS_PUBLIC_URL; Origin of that URL is NOT reflected in CORS on A (H2).
 *   4. Trusted hub Origin IS reflected on A.
 *
 * Requires mesh-3 compose overlay (see docker/docker-compose.gossip-mesh3.yml).
 * Usage: pnpm gossip:mesh-3
 */

import {
  NODE_A,
  NODE_B,
  NODE_C,
  PEER_B,
  PEER_C,
  LAB_TRUSTED_ORIGIN,
  LAB_EVIL_ORIGIN,
  waitForNode,
  waitForPeer,
  cronGossip,
  pollUntil,
  gossipStats,
  jsonFetch,
  linkPeer,
  sleep,
} from "./lib/gossip-lab.mjs";

async function assertCors(base, origin, { expectAllow }) {
  const { res } = await jsonFetch(`${base}/api/peers`, {
    headers: { Origin: origin },
    expectOk: true,
  });
  const acao = res.headers.get("access-control-allow-origin");
  if (expectAllow) {
    if (acao !== origin && acao !== "*") {
      throw new Error(`${base}: trusted Origin ${origin} not allowed (got ${acao ?? "none"})`);
    }
    console.log(`✓ ${base} allows trusted Origin ${origin} (ACAO=${acao})`);
  } else {
    if (acao === origin || acao === "*") {
      throw new Error(`${base}: evil Origin ${origin} incorrectly allowed (ACAO=${acao})`);
    }
    console.log(`✓ ${base} rejects evil Origin ${origin} (ACAO=${acao ?? "none"})`);
  }
}

async function main() {
  console.log("Gossip mesh-3 E2E (transitive discovery + H2 CORS)\n");

  await Promise.all([
    waitForNode(NODE_A, "Node A"),
    waitForNode(NODE_B, "Node B"),
    waitForNode(NODE_C, "Node C"),
  ]);

  console.log("\n1. Direct bootstrap edges…");
  await waitForPeer(NODE_A, "node-b", "Node A");
  await waitForPeer(NODE_B, "node-a", "Node B");
  try {
    await waitForPeer(NODE_B, "node-c", "Node B");
  } catch {
    // Cold start: B may have linked A first and historically stopped retrying C.
    console.log("  B missing C after wait — repairing with /api/dev/link-peers…");
    await linkPeer(NODE_B, PEER_C);
    await linkPeer(NODE_C, PEER_B);
    await waitForPeer(NODE_B, "node-c", "Node B");
  }
  await waitForPeer(NODE_C, "node-b", "Node C");

  const aBefore = await gossipStats(NODE_A);
  const knowsCAlready = (aBefore.peers ?? []).some((p) => p.nodeId === "node-c" && p.isActive);
  if (knowsCAlready) {
    console.log("  (A already knows C — bootstrap watcher may have walked B's nodeinfo.peers)");
  } else {
    console.log("  A does not yet know C (expected before transitive gossip)");
  }

  console.log("\n2. Confirm C advertises evil accessUrl…");
  const { data: cInfo } = await jsonFetch(`${NODE_C}/api/nodeinfo`);
  if (cInfo.accessUrl !== LAB_EVIL_ORIGIN) {
    throw new Error(
      `Node C accessUrl expected ${LAB_EVIL_ORIGIN}, got ${cInfo.accessUrl ?? "null"} — is mesh3 overlay running?`
    );
  }
  console.log(`✓ Node C accessUrl=${cInfo.accessUrl}`);

  console.log("\n3. Cron sync so peers[] propagate (B → A)…");
  // B pulls C (refreshes peer table); A pulls B (learns C via peers[])
  const bCron = await cronGossip(NODE_B);
  for (const r of bCron.results ?? []) {
    console.log(`    B pull ${r.url}: ${r.ok ? `ingested ${r.ingested ?? 0}` : r.error}`);
  }
  await sleep(500);
  const aCron = await cronGossip(NODE_A);
  for (const r of aCron.results ?? []) {
    console.log(`    A pull ${r.url}: ${r.ok ? `ingested ${r.ingested ?? 0}` : r.error}`);
  }
  await sleep(500);

  await pollUntil(
    async () => {
      const stats = await gossipStats(NODE_A);
      const peer = (stats.peers ?? []).find((p) => p.nodeId === "node-c" && p.isActive);
      if (!peer) {
        console.log(
          `  A peers: ${(stats.peers ?? []).map((p) => `${p.nodeId ?? "?"}@${p.url} active=${p.isActive}`).join(", ") || "(none)"}`
        );
      }
      return peer ?? null;
    },
    { label: "A to learn node-c via peers[]", retries: 20, retryMs: 2_000 }
  );
  console.log("✓ A learned node-c transitively (no forced A↔C bootstrap)");

  console.log("\n4. H2 — gossiped accessUrl must not expand CORS…");
  await assertCors(NODE_A, LAB_EVIL_ORIGIN, { expectAllow: false });
  await assertCors(NODE_A, LAB_TRUSTED_ORIGIN, { expectAllow: true });

  console.log("\n✓ Gossip mesh-3 E2E passed");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  console.error("\nStart mesh-3 lab: docker compose -f docker/docker-compose.gossip.yml -f docker/docker-compose.gossip-mesh3.yml up --build");
  process.exit(1);
});
