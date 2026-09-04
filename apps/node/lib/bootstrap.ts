/**
 * lib/bootstrap.ts
 *
 * Called once at node startup (via the instrumentation hook).
 *
 * Performs organic peer discovery by contacting BOOTSTRAP_PEERS and
 * exchanging nodeinfo. No central registry needed.
 *
 * BOOTSTRAP_PEERS — comma-separated list of seed node URLs.
 */

import { NODE_URL } from "@/lib/nodeInfo";
import { prisma } from "@/lib/prisma";
import { isSelfPeer, linkPeerUrl } from "@/lib/linkPeer";
import { canonicalizeLabPeerUrl } from "@/lib/gossipLabUrls";

function bootstrapSeedUrls(): string[] {
  return (process.env.BOOTSTRAP_PEERS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((u) => u.replace(/\/$/, "") !== NODE_URL.replace(/\/$/, ""))
    .filter((u, i, a) => a.indexOf(u) === i);
}

function seedUrlKeys(seedUrl: string): string[] {
  const normalized = seedUrl.replace(/\/$/, "");
  const canonical = canonicalizeLabPeerUrl(normalized);
  return canonical !== normalized ? [normalized, canonical] : [normalized];
}

/** How many configured BOOTSTRAP_PEERS are already active in NodePeer. */
export async function countLinkedBootstrapSeeds(seeds = bootstrapSeedUrls()): Promise<number> {
  if (seeds.length === 0) return 0;
  const peers = await prisma.nodePeer.findMany({
    where: { isActive: true },
    select: { url: true },
  });
  const peerUrls = new Set(peers.map((p) => p.url.replace(/\/$/, "")));
  let linked = 0;
  for (const seed of seeds) {
    if (seedUrlKeys(seed).some((k) => peerUrls.has(k))) linked += 1;
  }
  return linked;
}

/**
 * Bootstrap peer discovery from BOOTSTRAP_PEERS env var.
 */
export async function registerWithRegistry(): Promise<void> {
  const activePeers = await prisma.nodePeer.findMany({
    where: { isActive: true },
    select: { id: true, url: true, nodeId: true },
  });
  for (const peer of activePeers) {
    if (isSelfPeer(peer.url, peer.nodeId)) {
      await prisma.nodePeer.update({
        where: { id: peer.id },
        data: { isActive: false },
      });
    }
  }

  const adminExists = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  if (!adminExists) {
    console.warn(
      "[bootstrap] ⚠️  No admin account found. " +
        "Open the node web UI to complete first-time setup and create an admin account."
    );
  }

  const seeds = bootstrapSeedUrls();

  if (seeds.length === 0) {
    console.info("[bootstrap] No BOOTSTRAP_PEERS configured — running as isolated node.");
    return;
  }

  for (const seedUrl of seeds) {
    const result = await linkPeerUrl(seedUrl);
    if (!result.ok) {
      console.warn(`[bootstrap] Could not reach seed ${seedUrl}: ${result.error}`);
      continue;
    }
    console.info(`[bootstrap] Discovered peer ${result.nodeId ?? seedUrl}`);
  }
}

/** GOSSIP_DEV: retry bootstrap until all seed peers appear (docker gossip lab cold start). */
export async function registerWithRegistryDevRetry(): Promise<void> {
  const seeds = bootstrapSeedUrls();
  const maxAttempts = process.env.GOSSIP_DEV === "true" ? 24 : 1;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await registerWithRegistry();
    const linked = await countLinkedBootstrapSeeds(seeds);
    if (seeds.length === 0 || linked >= seeds.length || attempt === maxAttempts) break;
    console.info(
      `[bootstrap] Linked ${linked}/${seeds.length} seeds — retry ${attempt}/${maxAttempts} in 5s…`
    );
    await new Promise((r) => setTimeout(r, 5_000));
  }
}

/**
 * Keep trying bootstrap in gossip lab until every BOOTSTRAP_PEERS seed is linked.
 * Previously stopped after the first peer — mesh-3 hubs (B→A,C) then never retried C.
 */
export function startGossipDevBootstrapWatcher(): void {
  if (process.env.GOSSIP_DEV !== "true") return;

  const seeds = bootstrapSeedUrls();
  if (seeds.length === 0) return;

  const intervalMs = 15_000;
  const timer = setInterval(async () => {
    try {
      const linked = await countLinkedBootstrapSeeds(seeds);
      if (linked >= seeds.length) {
        clearInterval(timer);
        return;
      }
      console.info(
        `[bootstrap] Gossip lab: linked ${linked}/${seeds.length} seeds — retrying discovery…`
      );
      await registerWithRegistry();
    } catch (err) {
      console.warn("[bootstrap] Gossip lab retry failed:", err);
    }
  }, intervalMs);

  // Stop after 15 minutes so we don't leak timers in long-running dev
  setTimeout(() => clearInterval(timer), 15 * 60 * 1000);
}
