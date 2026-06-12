import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import type { NextRequest } from "next/server";

interface RemoteNodeInfo {
  nodeId?: string;
  region?: string;
  bbox?: string | null;
  publicKeyPem?: string | null;
}

async function fetchNodeInfo(url: string): Promise<RemoteNodeInfo | null> {
  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/api/nodeinfo`, {
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return null;
    return (await res.json()) as RemoteNodeInfo;
  } catch {
    return null;
  }
}

/**
 * POST /api/nodes/refresh
 * Re-fetches /api/nodeinfo for every active peer and updates the local record.
 * Peers that are unreachable are left active but their lastSeen is not updated.
 * Admin-only.
 */
export async function POST(req: NextRequest) {
  const authError = await requireRole(req, "ADMIN");
  if (authError) return authError;

  const peers = await prisma.nodePeer.findMany({ where: { isActive: true } });

  const results = await Promise.allSettled(
    peers.map(async (peer) => {
      const info = await fetchNodeInfo(peer.url);
      if (!info) return { url: peer.url, ok: false };

      await prisma.nodePeer.update({
        where: { url: peer.url },
        data: {
          nodeId: info.nodeId ?? undefined,
          region: info.region ?? undefined,
          bbox: info.bbox ?? undefined,
          publicKey: info.publicKeyPem ?? undefined,
          lastSeen: new Date(),
        },
      });
      return { url: peer.url, ok: true };
    })
  );

  const updated = results.filter(
    (r) => r.status === "fulfilled" && r.value.ok
  ).length;
  const failed = results.length - updated;

  return NextResponse.json({ updated, failed, total: peers.length });
}
