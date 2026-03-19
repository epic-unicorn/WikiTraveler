import { NextResponse } from "next/server";
import { NODE_URL, NODE_ID, NODE_VERSION } from "@/lib/nodeInfo";

/**
 * GET /.well-known/webfinger
 *
 * Standard WebFinger-style discovery endpoint. Any peer node (or tool) can hit
 * this URL to learn this node's identity and public key without prior configuration.
 *
 * Follows the pattern used by ActivityPub/Mastodon servers, adapted for the
 * WikiTraveler structured-data use case.
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
        "https://wikitraveler.org/ns#publicKey":
          process.env.NODE_PUBLIC_KEY ?? null,
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
