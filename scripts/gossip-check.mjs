/**
 * Smoke-check gossip lab: peers registered + property counts.
 *
 * Usage: pnpm gossip:check
 */

const NODE_A = (process.env.NODE_A_URL ?? "http://localhost:3000").replace(/\/$/, "");
const NODE_B = (process.env.NODE_B_URL ?? "http://localhost:3010").replace(/\/$/, "");

async function nodeinfo(base) {
  const res = await fetch(`${base}/api/nodeinfo`, { signal: AbortSignal.timeout(8_000) });
  if (!res.ok) throw new Error(`${base}/api/nodeinfo → ${res.status}`);
  return res.json();
}

async function gossipStats(base) {
  const res = await fetch(`${base}/api/dev/gossip-stats`, { signal: AbortSignal.timeout(8_000) });
  if (!res.ok) return null;
  return res.json();
}

function peerSummary(info) {
  return (info.peers ?? []).map((p) => `${p.nodeId ?? "?"} @ ${p.url}`).join(", ") || "(none)";
}

function statsPeerSummary(stats) {
  if (!stats?.peers?.length) return "(none in DB)";
  return stats.peers
    .map((p) => `${p.nodeId ?? "?"} @ ${p.url}${p.isActive ? "" : " [inactive]"}`)
    .join(", ");
}

function hasActivePeer(stats, nodeId) {
  return (stats?.peers ?? []).some((p) => p.isActive && p.nodeId === nodeId);
}

function hasInactivePeer(stats, nodeId) {
  return (stats?.peers ?? []).some((p) => !p.isActive && p.nodeId === nodeId);
}

async function main() {
  console.log("Gossip lab check\n");

  const [aInfo, bInfo, aStats, bStats] = await Promise.all([
    nodeinfo(NODE_A),
    nodeinfo(NODE_B),
    gossipStats(NODE_A),
    gossipStats(NODE_B),
  ]);

  console.log(`Node A (${aInfo.nodeId}) @ ${NODE_A}`);
  console.log(`Node B (${bInfo.nodeId}) @ ${NODE_B}`);

  const aSeesB = (aInfo.peers ?? []).some((p) => p.nodeId === "node-b");
  const bSeesA = (bInfo.peers ?? []).some((p) => p.nodeId === "node-a");

  const aHasB = hasActivePeer(aStats, "node-b");
  const bHasA = hasActivePeer(bStats, "node-a");
  const aInactiveB = hasInactivePeer(aStats, "node-b");

  console.log(`\nActive peers (nodeinfo — used for sync/push):`);
  console.log(`  A: ${peerSummary(aInfo)}`);
  console.log(`  B: ${peerSummary(bInfo)}`);

  if (aStats && bStats) {
    console.log(`\nPeer records (database):`);
    console.log(`  A: ${statsPeerSummary(aStats)}`);
    console.log(`  B: ${statsPeerSummary(bStats)}`);
    console.log(`\nData:`);
    console.log(`  A: ${aStats.propertyCount} properties, ${aStats.factCount} facts`);
    console.log(`  B: ${bStats.propertyCount} properties, ${bStats.factCount} facts`);
  }

  const linked = aHasB && bHasA;
  console.log(`\nMutual link: ${linked ? "yes" : "NO"}`);

  if (!linked) {
    if (aInactiveB) {
      console.log("\nNode B is registered on A but marked inactive (often after a failed gossip:sync).");
    } else if (!aHasB && bHasA) {
      console.log("\nOne-way link: B knows A, but A does not know B.");
    }
    console.log("Repair: pnpm gossip:link-peers");
    process.exitCode = 1;
    return;
  }

  console.log("\n✓ Gossip lab peers are linked. Submit an audit on A, then run pnpm gossip:sync.");
}

main().catch((err) => {
  console.error(err.message ?? err);
  console.error("\nIs the gossip lab running?  pnpm dev:gossip-lab");
  process.exit(1);
});
