/**
 * Federation compatibility check for CI and local runs.
 *
 * Expects gossip lab running (optionally with gossip-compat overlay for N-1).
 *
 * Usage:
 *   pnpm gossip:compat
 *   GOSSIP_COMPAT_MIXED=1 pnpm gossip:compat   # with compose overlay
 */

import { spawnSync } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const NODE_A = (process.env.NODE_A_URL ?? "http://localhost:3000").replace(/\/$/, "");
const NODE_B = (process.env.NODE_B_URL ?? "http://localhost:3010").replace(/\/$/, "");

const RETRIES = Number(process.env.GOSSIP_COMPAT_RETRIES ?? 40);
const RETRY_MS = Number(process.env.GOSSIP_COMPAT_RETRY_MS ?? 5000);

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForNode(base, label) {
  for (let i = 1; i <= RETRIES; i++) {
    try {
      const res = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(5_000) });
      if (res.ok) {
        console.log(`✓ ${label} ready`);
        return;
      }
    } catch {
      // retry
    }
    if (i < RETRIES) {
      console.log(`  waiting for ${label} (${i}/${RETRIES})…`);
      await sleep(RETRY_MS);
    }
  }
  throw new Error(`${label} did not become ready at ${base}`);
}

async function nodeinfo(base) {
  const res = await fetch(`${base}/api/nodeinfo`, { signal: AbortSignal.timeout(8_000) });
  if (!res.ok) throw new Error(`${base}/api/nodeinfo → ${res.status}`);
  return res.json();
}

async function gossipStats(base) {
  const res = await fetch(`${base}/api/dev/gossip-stats`, { signal: AbortSignal.timeout(8_000) });
  if (!res.ok) throw new Error(`${base}/api/dev/gossip-stats → ${res.status}`);
  return res.json();
}

async function snapshotProtocol(base) {
  const res = await fetch(`${base}/api/gossip/snapshot?since=1970-01-01T00:00:00.000Z`, {
    signal: AbortSignal.timeout(8_000),
  });
  if (res.status === 401) {
    console.log(`  (snapshot on ${base} requires auth — skipped in compat check)`);
    return null;
  }
  if (!res.ok) throw new Error(`${base}/api/gossip/snapshot → ${res.status}`);
  const data = await res.json();
  return data.protocolVersion ?? null;
}

function run(cmd, args, env = {}) {
  const result = spawnSync(cmd, args, {
    cwd: ROOT,
    stdio: "inherit",
    shell: true,
    env: { ...process.env, ...env },
  });
  if (result.status !== 0) {
    throw new Error(`${cmd} ${args.join(" ")} failed`);
  }
}

async function main() {
  console.log("Gossip federation compat check\n");

  await Promise.all([
    waitForNode(NODE_A, "Node A"),
    waitForNode(NODE_B, "Node B"),
  ]);

  const [aInfo, bInfo] = await Promise.all([nodeinfo(NODE_A), nodeinfo(NODE_B)]);
  console.log(`\nVersions: A=${aInfo.version} (gossip ${aInfo.gossipProtocol}), B=${bInfo.version} (gossip ${bInfo.gossipProtocol})`);

  if (aInfo.gossipProtocol !== bInfo.gossipProtocol) {
    throw new Error(`Gossip protocol mismatch: A=${aInfo.gossipProtocol}, B=${bInfo.gossipProtocol}`);
  }

  const mixed = process.env.GOSSIP_COMPAT_MIXED === "1";
  if (mixed) {
    if (aInfo.version === bInfo.version) {
      throw new Error("Mixed compat expected different node versions (use gossip-compat compose overlay)");
    }
    const gap = Math.abs(
      Number((aInfo.version ?? "0").split(".")[1] ?? 0)
      - Number((bInfo.version ?? "0").split(".")[1] ?? 0)
    );
    if (gap > 1) {
      throw new Error(`Version gap too large for N↔N-1 policy: ${aInfo.version} ↔ ${bInfo.version}`);
    }
    console.log(`✓ Mixed-version lab: ${aInfo.version} ↔ ${bInfo.version}`);
  }

  console.log("\nSeeding lab databases…");
  run("node", ["scripts/gossip-seed.mjs"]);

  console.log("\nLinking peers…");
  run("node", ["scripts/gossip-link-peers.mjs"]);

  const aStatsAfterLink = await gossipStats(NODE_A);
  const bPeerOnA = (aStatsAfterLink.peers ?? []).find((p) => p.nodeId === "node-b" && p.isActive);
  if (!bPeerOnA?.lastKnownVersion) {
    throw new Error("Node A did not cache peer version after link");
  }
  console.log(`✓ Node A cached peer B version: ${bPeerOnA.lastKnownVersion} (gossip ${bPeerOnA.gossipProtocol ?? "?"})`);

  if (mixed && bPeerOnA.lastKnownVersion !== bInfo.version) {
    throw new Error(`Cached version mismatch: expected ${bInfo.version}, got ${bPeerOnA.lastKnownVersion}`);
  }

  console.log("\nSyncing gossip…");
  run("node", ["scripts/gossip-sync.mjs"]);

  const [aStats, bStats] = await Promise.all([gossipStats(NODE_A), gossipStats(NODE_B)]);
  console.log(`\nAfter sync:`);
  console.log(`  A: ${aStats.propertyCount} properties, ${aStats.factCount} facts`);
  console.log(`  B: ${bStats.propertyCount} properties, ${bStats.factCount} facts`);

  if (aStats.propertyCount < 1 || bStats.propertyCount < 1) {
    throw new Error("Expected seeded properties on both nodes");
  }

  const protoA = await snapshotProtocol(NODE_A);
  const protoB = await snapshotProtocol(NODE_B);
  if (protoA != null && protoB != null && protoA !== protoB) {
    throw new Error(`Snapshot protocolVersion mismatch: A=${protoA}, B=${protoB}`);
  }
  if (protoA != null) {
    console.log(`✓ GossipDelta protocolVersion: ${protoA}`);
  }

  console.log("\n✓ Gossip federation compat check passed");
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
