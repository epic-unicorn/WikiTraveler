import { NextResponse } from "next/server";
import { NODE_URL, NODE_ID, NODE_VERSION } from "@/lib/nodeInfo";
import { normalizePem } from "@/lib/auth";

/**
 * GET /.well-known/webfinger
 *
 * Discovery helper for node identity, inbox, and public key PEM.
 * Cross-node JWT verification uses `GET /.well-known/pubkey` (see FEDERATED-AUTH.md);
 * this endpoint remains for ActivityPub-style tooling and peer bootstrap helpers.
 */
export async function GET() {
  return NextResponse.json(
    {
      subject: NODE_URL,
      links: [
        {
          rel: "self",
          type: "application/json",
          href: `${NODE_URL}/api/nodeinfo`,
        },
        {
          rel: "https://wikitraveler.org/ns#inbox",
          type: "application/json",
          href: `${NODE_URL}/api/inbox`,
        },
      ],
      properties: {
        "https://wikitraveler.org/ns#nodeId": NODE_ID,
        "https://wikitraveler.org/ns#version": NODE_VERSION,
        "https://wikitraveler.org/ns#publicKey": normalizePem(process.env.NODE_PUBLIC_KEY),
      },
    },
    {
      headers: {
        "Content-Type": "application/jrd+json",
        "Cache-Control": "public, max-age=3600",
      },
    }
  );
}
