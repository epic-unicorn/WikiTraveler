import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { NODE_URL } from "@/lib/nodeInfo";
import type { NextRequest } from "next/server";

/**
 * GET /api/cron/gossip
 *
 * Pulls peer list from the central registry, then fetches delta snapshots
 * from each peer and ingests them.
 * Callable by Vercel Cron (vercel.json) or a setInterval wrapper in Docker.
 *
 * Protected by CRON_SECRET env var when running on Vercel.
 */
export async function GET(req: NextRequest) {
  // Validate Vercel-style cron secret when configured
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
  }

  // Use local NodePeer table — no registry dependency
  const localPeers = await prisma.nodePeer.findMany({ where: { isActive: true } });
  const peerUrls: string[] = localPeers.map((p) => p.url);

  const results: Array<{ url: string; ok: boolean; ingested?: number; error?: string }> = [];

  for (const peerUrl of peerUrls) {
    try {
      // Fetch delta from peer
      const snapshotRes = await fetch(`${peerUrl}/api/gossip/snapshot`, {
        signal: AbortSignal.timeout(10_000),
      });
      if (!snapshotRes.ok) throw new Error(`snapshot fetch failed: ${snapshotRes.status}`);
      const delta = await snapshotRes.json();

      // Ingest into self
      const ingestRes = await fetch(`${NODE_URL}/api/gossip/ingest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(delta),
        signal: AbortSignal.timeout(10_000),
      });
      const ingestData = await ingestRes.json() as { ingested?: number };

      // Upsert peer with latest metadata from delta
      const peerNodeId = (delta as { fromNodeId?: string }).fromNodeId;
      await prisma.nodePeer.upsert({
        where: { url: peerUrl },
        update: { lastSeen: new Date(), isActive: true, ...(peerNodeId ? { nodeId: peerNodeId } : {}) },
        create: { url: peerUrl, nodeId: peerNodeId, isActive: true },
      });

      results.push({ url: peerUrl, ok: true, ingested: ingestData.ingested });
    } catch (err) {
      // Mark peer inactive after failure but don't halt the cron
      await prisma.nodePeer.update({
        where: { url: peerUrl },
        data: { isActive: false },
      }).catch(() => {/* best-effort */});
      results.push({ url: peerUrl, ok: false, error: String(err) });
    }
  }

  return NextResponse.json({ ran: new Date().toISOString(), results });
}
