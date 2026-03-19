/**
 * lib/bootstrap.ts
 *
 * Called once at node startup (via the instrumentation hook).
 *
 * Reads BOOTSTRAP_PEERS — a comma-separated list of peer node URLs — and
 * upserts each into NodePeer so the gossip cron can find them without any
 * manual DB entry.
 *
 * Example .env:
 *   BOOTSTRAP_PEERS=https://node-a.wikitraveler.org,https://node-b.wikitraveler.org
 */

import { prisma } from "@/lib/prisma";
import { NODE_ID, NODE_URL } from "@/lib/nodeInfo";

export async function bootstrapPeers(): Promise<void> {
  const raw = process.env.BOOTSTRAP_PEERS ?? "";
  const urls = raw
    .split(",")
    .map((u) => u.trim())
    .filter((u) => {
      if (!u) return false;
      try {
        const parsed = new URL(u);
        return ["http:", "https:"].includes(parsed.protocol);
      } catch {
        console.warn(`[bootstrap] Invalid peer URL skipped: ${u}`);
        return false;
      }
    });

  if (urls.length === 0) return;

  console.log(`[bootstrap] Seeding ${urls.length} peer(s) from BOOTSTRAP_PEERS`);

  for (const url of urls) {
    await prisma.nodePeer.upsert({
      where: { url },
      update: { isActive: true },
      create: { url, isActive: true },
    });
  }
}

/**
 * Announce this node's URL to a peer by calling POST /api/nodes on that peer.
 * Fire-and-forget — failures are logged but do not throw.
 */
export async function announceTopeer(peerUrl: string): Promise<void> {
  if (!NODE_URL || NODE_URL === "http://localhost:3000") return; // skip in local dev

  try {
    const res = await fetch(`${peerUrl}/api/nodes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: NODE_URL, nodeId: NODE_ID }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) {
      console.warn(`[bootstrap] Self-announce to ${peerUrl} returned ${res.status}`);
    }
  } catch (err) {
    console.warn(`[bootstrap] Self-announce to ${peerUrl} failed:`, err);
  }
}
