import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { NODE_ID, NODE_URL, NODE_VERSION } from "@/lib/nodeInfo";
import { GOSSIP_PROTOCOL_VERSION } from "@wikitraveler/core";
import { assessPeerSkew } from "@/lib/peerVersion";
import {
  fetchRemoteNodeInfo,
  peerVersionFields,
} from "@/lib/remoteNodeInfo";
import { validatePeerBaseUrl } from "@/lib/peerUrl";
import type { NextRequest } from "next/server";


export { dynamic } from "@/lib/apiRoute";
// GET /api/nodes — lists locally known active peers (used by inbox push)
export async function GET() {
  const rows = await prisma.nodePeer.findMany({
    where: { isActive: true },
    orderBy: { lastSeen: "desc" },
  });
  const peers = rows
    .filter((p) => p.nodeId !== NODE_ID)
    .map((peer) => {
      const skew = assessPeerSkew({
        localVersion: NODE_VERSION,
        localGossipProtocol: GOSSIP_PROTOCOL_VERSION,
        peerVersion: peer.lastKnownVersion,
        peerGossipProtocol: peer.gossipProtocol,
      });
      return {
        ...peer,
        skewLevel: skew.level,
        skewMessage: skew.message,
      };
    });
  return NextResponse.json({
    peers,
    localVersion: NODE_VERSION,
    localGossipProtocol: GOSSIP_PROTOCOL_VERSION,
  });
}

/**
 * POST /api/nodes
 * Add a peer by URL. Fetches /api/nodeinfo from the target to verify it is
 * reachable and to populate nodeId / region / bbox. Admin-only.
 * Body: { url: string }
 */
export async function POST(req: NextRequest) {
  const authError = await requireRole(req, "ADMIN");
  if (authError) return authError;

  let body: { url?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }

  const url = body.url?.trim();
  if (!url) {
    return NextResponse.json({ message: "url is required" }, { status: 422 });
  }

  const validated = validatePeerBaseUrl(url);
  if (!validated.ok) {
    return NextResponse.json({ message: validated.reason }, { status: 422 });
  }
  if (validated.url === NODE_URL?.replace(/\/$/, "")) {
    return NextResponse.json(
      { message: "Cannot add this node as its own peer" },
      { status: 400 }
    );
  }

  const info = await fetchRemoteNodeInfo(validated.url);
  if (!info) {
    return NextResponse.json(
      { message: `Could not reach node at ${validated.url}. Check the URL and try again.` },
      { status: 502 }
    );
  }

  const versionFields = peerVersionFields(info);
  const peer = await prisma.nodePeer.upsert({
    where: { url: validated.url },
    update: {
      nodeId: info.nodeId ?? undefined,
      region: info.region ?? undefined,
      bbox: info.bbox ?? undefined,
      publicKey: info.publicKeyPem ?? undefined,
      lastKnownVersion: versionFields.lastKnownVersion ?? undefined,
      gossipProtocol: versionFields.gossipProtocol ?? undefined,
      lastSeen: new Date(),
      isActive: true,
    },
    create: {
      url: validated.url,
      nodeId: info.nodeId ?? null,
      region: info.region ?? null,
      bbox: info.bbox ?? null,
      publicKey: info.publicKeyPem ?? null,
      lastKnownVersion: versionFields.lastKnownVersion,
      gossipProtocol: versionFields.gossipProtocol,
      isActive: true,
    },
  });

  return NextResponse.json({ peer }, { status: 201 });
}

/**
 * DELETE /api/nodes?url=<encoded-url>
 * Deactivate a peer. The row is kept for audit history; isActive is set to
 * false. The peer can be re-added via POST. Admin-only.
 */
export async function DELETE(req: NextRequest) {
  const authError = await requireRole(req, "ADMIN");
  if (authError) return authError;

  const url = req.nextUrl.searchParams.get("url");
  if (!url) {
    return NextResponse.json(
      { message: "url query parameter is required" },
      { status: 422 }
    );
  }

  const existing = await prisma.nodePeer.findUnique({ where: { url } });
  if (!existing) {
    return NextResponse.json({ message: "Peer not found" }, { status: 404 });
  }

  await prisma.nodePeer.update({
    where: { url },
    data: { isActive: false },
  });

  return NextResponse.json({ ok: true });
}
