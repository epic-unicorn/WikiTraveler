import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { linkPeerUrl } from "@/lib/linkPeer";


export const dynamic = "force-dynamic";
/**
 * POST /api/dev/link-peers
 * Body: { peerUrl: string }
 *
 * Dev/gossip-lab only — registers a remote node in the local NodePeer table.
 */
export async function POST(req: NextRequest) {
  if (process.env.GOSSIP_DEV !== "true" && process.env.NODE_ENV === "production") {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  let body: { peerUrl?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }

  const peerUrl = body.peerUrl?.trim();
  if (!peerUrl) {
    return NextResponse.json({ message: "peerUrl is required" }, { status: 400 });
  }

  const result = await linkPeerUrl(peerUrl);
  if (!result.ok) {
    return NextResponse.json({ message: result.error }, { status: 502 });
  }

  return NextResponse.json({ ok: true, nodeId: result.nodeId, url: result.url });
}
