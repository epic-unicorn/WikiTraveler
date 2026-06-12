import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { NODE_URL } from "@/lib/nodeInfo";
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

// GET /api/nodes — lists locally known active peers (used by inbox push)
export async function GET() {
  const peers = await prisma.nodePeer.findMany({
    where: { isActive: true },
    orderBy: { lastSeen: "desc" },
  });
  return NextResponse.json({ peers });
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

  const url = body.url?.trim().replace(/\/$/, "");
  if (!url) {
    return NextResponse.json({ message: "url is required" }, { status: 422 });
  }
  try {
    new URL(url);
  } catch {
    return NextResponse.json({ message: "Invalid URL" }, { status: 422 });
  }
  if (url === NODE_URL?.replace(/\/$/, "")) {
    return NextResponse.json(
      { message: "Cannot add this node as its own peer" },
      { status: 400 }
    );
  }

  const info = await fetchNodeInfo(url);
  if (!info) {
    return NextResponse.json(
      { message: `Could not reach node at ${url}. Check the URL and try again.` },
      { status: 502 }
    );
  }

  const peer = await prisma.nodePeer.upsert({
    where: { url },
    update: {
      nodeId: info.nodeId ?? undefined,
      region: info.region ?? undefined,
      bbox: info.bbox ?? undefined,
      publicKey: info.publicKeyPem ?? undefined,
      lastSeen: new Date(),
      isActive: true,
    },
    create: {
      url,
      nodeId: info.nodeId ?? null,
      region: info.region ?? null,
      bbox: info.bbox ?? null,
      publicKey: info.publicKeyPem ?? null,
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
