import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { NextRequest } from "next/server";

/**
 * POST /v1/nodes/register
 *
 * Register a node in the registry or heartbeat an existing registration.
 *
 * Request body:
 *   - url: string (required) — the node's public base URL (e.g. https://node-a.wikitraveler.org)
 *   - nodeId: string (required) — unique identifier for the node
 *   - region: string (optional) — geographic region (e.g. "amsterdam", "berlin")
 *
 * Returns:
 *   { ok: true, nodeId, url }
 */
export async function POST(req: NextRequest) {
  let body: { url?: string; nodeId?: string; region?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }

  const { url, nodeId, region } = body;

  if (!url || typeof url !== "string") {
    return NextResponse.json({ message: "url is required and must be a string" }, { status: 400 });
  }
  if (!nodeId || typeof nodeId !== "string") {
    return NextResponse.json({ message: "nodeId is required and must be a string" }, { status: 400 });
  }

  // Validate URL
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return NextResponse.json({ message: "Invalid URL format" }, { status: 400 });
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    return NextResponse.json({ message: "Only http/https URLs are allowed" }, { status: 400 });
  }

  const normalizedUrl = parsed.origin + parsed.pathname.replace(/\/$/, "");

  try {
    // Upsert: create if new, otherwise update lastHeartbeat and isActive
    const node = await prisma.registryNode.upsert({
      where: { nodeId },
      update: {
        url: normalizedUrl,
        region: region ?? null,
        lastHeartbeat: new Date(),
        isActive: true,
      },
      create: {
        nodeId,
        url: normalizedUrl,
        region: region ?? null,
        isActive: true,
      },
    });

    return NextResponse.json({ ok: true, nodeId: node.nodeId, url: node.url });
  } catch (err) {
    console.error("[registry] Register failed:", err);
    return NextResponse.json({ message: "Registration failed" }, { status: 500 });
  }
}
