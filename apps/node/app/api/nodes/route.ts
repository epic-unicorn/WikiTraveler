import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/nodes
export async function GET() {
  const peers = await prisma.nodePeer.findMany({
    where: { isActive: true },
    orderBy: { lastSeen: "desc" },
  });
  return NextResponse.json({ peers });
}

// POST /api/nodes/register
export async function POST(req: Request) {
  let body: { url?: string; nodeId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }

  if (!body.url || typeof body.url !== "string") {
    return NextResponse.json({ message: "url is required" }, { status: 400 });
  }

  // Simple URL validation — prevent SSRF from hostile node registrations
  let parsed: URL;
  try {
    parsed = new URL(body.url);
  } catch {
    return NextResponse.json({ message: "Invalid URL" }, { status: 400 });
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    return NextResponse.json(
      { message: "Only http/https URLs are allowed" },
      { status: 400 }
    );
  }

  await prisma.nodePeer.upsert({
    where: { url: parsed.origin + parsed.pathname.replace(/\/$/, "") },
    update: { lastSeen: new Date(), isActive: true },
    create: {
      url: parsed.origin + parsed.pathname.replace(/\/$/, ""),
      isActive: true,
    },
  });

  return NextResponse.json({ ok: true });
}
