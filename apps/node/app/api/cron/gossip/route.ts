import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildNodeAuthHeaders } from "@/lib/auth";
import { INTERNAL_NODE_URL } from "@/lib/nodeInfo";
import {
  fetchRemoteNodeInfo,
  peerVersionFields,
} from "@/lib/remoteNodeInfo";
import type { NextRequest } from "next/server";
import { isSelfPeer } from "@/lib/linkPeer";

/**
 * GET /api/cron/gossip
 *
 * Pulls active peers from the local NodePeer table, fetches delta snapshots,
 * and ingests them locally.
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
  }

  const nodeHeaders = buildNodeAuthHeaders();
  if (!nodeHeaders) {
    return NextResponse.json(
      { message: "NODE_PRIVATE_KEY is required for gossip sync" },
      { status: 503 }
    );
  }

  const localPeers = await prisma.nodePeer.findMany({ where: { isActive: true } });
  const peerUrls: string[] = localPeers
    .filter((p) => !isSelfPeer(p.url, p.nodeId))
    .map((p) => p.url)
    .filter((url, i, a) => a.indexOf(url) === i);

  const results: Array<{ url: string; ok: boolean; ingested?: number; error?: string }> = [];

  for (const peerUrl of peerUrls) {
    try {
      const snapshotRes = await fetch(`${peerUrl.replace(/\/$/, "")}/api/gossip/snapshot`, {
        headers: nodeHeaders,
        signal: AbortSignal.timeout(10_000),
      });
      if (!snapshotRes.ok) throw new Error(`snapshot fetch failed: ${snapshotRes.status}`);
      const delta = await snapshotRes.json();

      const ingestRes = await fetch(`${INTERNAL_NODE_URL.replace(/\/$/, "")}/api/gossip/ingest`, {
        method: "POST",
        headers: { ...nodeHeaders, "Content-Type": "application/json" },
        body: JSON.stringify(delta),
        signal: AbortSignal.timeout(10_000),
      });
      if (!ingestRes.ok) throw new Error(`ingest failed: ${ingestRes.status}`);
      const ingestData = await ingestRes.json() as { ingested?: number };

      const peerNodeId = (delta as { fromNodeId?: string }).fromNodeId;
      const peerInfo = await fetchRemoteNodeInfo(peerUrl);
      const versionFields = peerInfo ? peerVersionFields(peerInfo) : null;
      await prisma.nodePeer.upsert({
        where: { url: peerUrl },
        update: {
          lastSeen: new Date(),
          isActive: true,
          ...(peerNodeId ? { nodeId: peerNodeId } : {}),
          ...(versionFields?.lastKnownVersion
            ? { lastKnownVersion: versionFields.lastKnownVersion }
            : {}),
          ...(versionFields?.gossipProtocol != null
            ? { gossipProtocol: versionFields.gossipProtocol }
            : {}),
        },
        create: {
          url: peerUrl,
          nodeId: peerNodeId,
          lastKnownVersion: versionFields?.lastKnownVersion ?? null,
          gossipProtocol: versionFields?.gossipProtocol ?? null,
          isActive: true,
        },
      });

      results.push({ url: peerUrl, ok: true, ingested: ingestData.ingested });
    } catch (err) {
      results.push({ url: peerUrl, ok: false, error: String(err) });
    }
  }

  return NextResponse.json({ ran: new Date().toISOString(), results });
}
