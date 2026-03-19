import { NextResponse } from "next/server";
import { NODE_ID, NODE_URL, NODE_VERSION } from "@/lib/nodeInfo";

/**
 * GET /api/nodeinfo
 *
 * Returns this node's public identity and RSA public key.
 * Peers cache the public key here for HTTP Signature verification on inbox pushes.
 */
export async function GET() {
  return NextResponse.json({
    nodeId: NODE_ID,
    nodeUrl: NODE_URL,
    version: NODE_VERSION,
    publicKey: process.env.NODE_PUBLIC_KEY ?? null,
  });
}
