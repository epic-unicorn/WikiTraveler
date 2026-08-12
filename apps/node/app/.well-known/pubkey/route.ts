import { NextResponse } from "next/server";
import { normalizePem } from "@/lib/auth";

/**
 * GET /.well-known/pubkey
 *
 * Returns this node's RSA public key in PEM format.
 * Used by peer nodes to verify RS256 JWTs issued by this node.
 *
 * The public key is expected in NODE_PUBLIC_KEY env var.
 */
export async function GET() {
  const publicKeyPem = normalizePem(process.env.NODE_PUBLIC_KEY);

  if (!publicKeyPem) {
    return NextResponse.json({ message: "No public key configured" }, { status: 404 });
  }

  return NextResponse.json({ publicKeyPem });
}
