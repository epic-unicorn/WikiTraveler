import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { NODE_URL } from "@/lib/nodeInfo";
import type { NextRequest } from "next/server";

/**
 * GET /api/cron/gossip
 *
 * Pulls delta snapshots from all active peers and ingests them.
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

  const peers = await prisma.nodePeer.findMany({ where: { isActive: true } });
  const results: Array<{ url: string; ok: boolean; ingested?: number; error?: string }> = [];

  for (const peer of peers) {
    try {
      // Fetch delta from peer
      const snapshotRes = await fetch(`${peer.url}/api/gossip/snapshot`, {
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

      // Update peer last-seen
      await prisma.nodePeer.update({
        where: { id: peer.id },
        data: { lastSeen: new Date() },
      });

      results.push({ url: peer.url, ok: true, ingested: ingestData.ingested });
    } catch (err) {
      // Mark peer inactive after failure but don't halt the cron
      await prisma.nodePeer.update({
        where: { id: peer.id },
        data: { isActive: false },
      }).catch(() => {/* best-effort */});
      results.push({ url: peer.url, ok: false, error: String(err) });
    }
  }

  return NextResponse.json({ ran: new Date().toISOString(), results });
}
