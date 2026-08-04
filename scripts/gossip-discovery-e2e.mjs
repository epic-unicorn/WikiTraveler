/**
 * End-to-end multi-node discovery + gossip.
 *
 * Asserts organic bootstrap discovery (BOOTSTRAP_PEERS), peer table population,
 * gossip sync of properties/facts, snapshot protocolVersion, and pubkey reachability
 * for cross-node JWT verification — without calling gossip-link-peers.
 *
 * Usage (gossip lab must be running with BOOTSTRAP_PEERS set):
 *   pnpm gossip:discovery
 *
 * CI: run after compose up in gossip-compat workflow (same-version or mixed).
 */

import { spawnSync } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { buildNodeAuthHeaders, loadGossipLabPrivateKey } from "./gossip-node-auth.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const NODE_A = (process.env.NODE_A_URL ?? "http://localhost:3000").replace(/\/$/, "");
const NODE_B = (process.env.NODE_B_URL ?? "http://localhost:3010").replace(/\/$/, "");

const RETRIES = Number(process.env.GOSSIP_DISCOVERY_RETRIES ?? 40);
const RETRY_MS = Number(process.env.GOSSIP_DISCOVERY_RETRY_MS ?? 5000);
const FETCH_RETRIES = Number(process.env.GOSSIP_DISCOVERY_FETCH_RETRIES ?? 8);
const FETCH_RETRY_MS = Number(process.env.GOSSIP_DISCOVERY_FETCH_RETRY_MS ?? 2_000);
const POST_SYNC_MS = Number(process.env.GOSSIP_DISCOVERY_POST_SYNC_MS ?? 3_000);

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchWithRetry(url, { label, timeoutMs = 8_000, retries = FETCH_RETRIES, retryMs = FETCH_RETRY_MS, init } = {}) {
  const name = label ?? url;
  let lastErr;
  for (let i = 1; i <= retries; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), ...init });
      if (!res.ok) throw new Error(`${name} → HTTP ${res.status}`);
      return res;
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      if (i < retries) {
        console.log(`  ${name} unavailable (${msg}), retry ${i}/${retries}…`);
        await sleep(retryMs);
      }
    }
  }
  throw new Error(`${name} failed after ${retries} attempts: ${lastErr instanceof Error ? lastErr.message : lastErr}`);
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
  const res = await fetchWithRetry(`${base}/api/nodeinfo`, { label: `${base}/api/nodeinfo` });
  return res.json();
}

async function gossipStats(base) {
  const res = await fetchWithRetry(`${base}/api/dev/gossip-stats`, {
    label: `${base}/api/dev/gossip-stats`,
  });
  return res.json();
}

async function waitForPeer(base, expectedNodeId, label) {
  for (let i = 1; i <= RETRIES; i++) {
    const stats = await gossipStats(base);
    const peer = (stats.peers ?? []).find((p) => p.nodeId === expectedNodeId && p.isActive);
    if (peer) {
      console.log(`✓ ${label} discovered peer ${expectedNodeId} (version ${peer.lastKnownVersion ?? "?"})`);
      return peer;
    }
    if (i < RETRIES) {
      console.log(`  waiting for ${label} to discover ${expectedNodeId} (${i}/${RETRIES})…`);
      await sleep(RETRY_MS);
    }
  }
  throw new Error(`${label} never discovered active peer ${expectedNodeId} via bootstrap/gossip`);
}

async function assertPubkey(base, label) {
  const res = await fetchWithRetry(`${base}/.well-known/pubkey`, {
    label: `${label} pubkey`,
  });
  const text = await res.text();
  if (!text.includes("BEGIN PUBLIC KEY") && !text.includes("BEGIN RSA PUBLIC KEY")) {
    // Some deployments return JSON { publicKeyPem }
    try {
      const json = JSON.parse(text);
      if (!json.publicKeyPem && !json.pem) {
        throw new Error("no pem");
      }
    } catch {
      throw new Error(`${label} /.well-known/pubkey did not return a PEM public key`);
    }
  }
  console.log(`✓ ${label} /.well-known/pubkey reachable (cross-node JWT)`);
}

const SNAPSHOT_SIGNERS = {
  [NODE_A]: "node-b",
  [NODE_B]: "node-a",
};

function snapshotAuthHeaders(base) {
  const signerId = SNAPSHOT_SIGNERS[base];
  if (!signerId) return {};
  try {
    const pem = loadGossipLabPrivateKey(signerId);
    return buildNodeAuthHeaders(signerId, pem);
  } catch {
    return {};
  }
}

async function snapshotProtocol(base) {
  const url = `${base}/api/gossip/snapshot?since=1970-01-01T00:00:00.000Z`;
  const headers = snapshotAuthHeaders(base);
  const res = await fetchWithRetry(url, {
    label: `${base}/api/gossip/snapshot`,
    init: Object.keys(headers).length > 0 ? { headers } : undefined,
  });
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
  console.log("Gossip discovery + federation E2E (no forced link-peers)\n");

  await Promise.all([
    waitForNode(NODE_A, "Node A"),
    waitForNode(NODE_B, "Node B"),
  ]);

  const [aInfo, bInfo] = await Promise.all([nodeinfo(NODE_A), nodeinfo(NODE_B)]);
  console.log(
    `\nVersions: A=${aInfo.version} (gossip ${aInfo.gossipProtocol}), B=${bInfo.version} (gossip ${bInfo.gossipProtocol})`
  );

  await Promise.all([assertPubkey(NODE_A, "Node A"), assertPubkey(NODE_B, "Node B")]);

  console.log("\nWaiting for organic bootstrap discovery (BOOTSTRAP_PEERS)…");
  await waitForPeer(NODE_A, "node-b", "Node A");
  await waitForPeer(NODE_B, "node-a", "Node B");

  console.log("\nSeeding lab databases…");
  run("node", ["scripts/gossip-seed.mjs"]);

  console.log("\nSyncing gossip (cron pull)…");
  run("node", ["scripts/gossip-sync.mjs"]);

  if (POST_SYNC_MS > 0) {
    console.log(`Waiting ${POST_SYNC_MS}ms for servers to settle…`);
    await sleep(POST_SYNC_MS);
  }

  const aStats = await gossipStats(NODE_A);
  const bStats = await gossipStats(NODE_B);
  console.log(`\nAfter sync:`);
  console.log(`  A: ${aStats.propertyCount} properties, ${aStats.factCount} facts, ${(aStats.peers ?? []).filter((p) => p.isActive).length} peers`);
  console.log(`  B: ${bStats.propertyCount} properties, ${bStats.factCount} facts, ${(bStats.peers ?? []).filter((p) => p.isActive).length} peers`);

  if (aStats.propertyCount < 1 || bStats.propertyCount < 1) {
    throw new Error("Expected seeded+synced properties on both nodes after discovery");
  }

  // Facts should appear on both sides after sync (seed puts facts on A and/or B depending on script)
  if ((aStats.factCount ?? 0) < 1 && (bStats.factCount ?? 0) < 1) {
    throw new Error("Expected accessibility facts on at least one node after seed/sync");
  }

  const protoA = await snapshotProtocol(NODE_A);
  const protoB = await snapshotProtocol(NODE_B);
  if (protoA != null && protoB != null && protoA !== protoB) {
    throw new Error(`Snapshot protocolVersion mismatch: A=${protoA}, B=${protoB}`);
  }
  if (protoA != null) {
    console.log(`✓ GossipDelta protocolVersion: ${protoA}`);
  }

  console.log("\n✓ Gossip discovery + federation E2E passed");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  if (err instanceof Error && err.cause) console.error("cause:", err.cause);
  process.exit(1);
});
