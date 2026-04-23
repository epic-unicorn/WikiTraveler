import { NextResponse } from "next/server";
import { signToken } from "@/lib/auth";
import { NODE_ID } from "@/lib/nodeInfo";

/**
 * POST /api/auth/token
 * @deprecated Use POST /api/auth/login instead.
 * Kept for one backward-compatible release. Accepts the shared COMMUNITY_PASSPHRASE.
 */
export async function POST(req: Request) {
  let body: { passphrase?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }

  const expected = process.env.COMMUNITY_PASSPHRASE;
  if (!expected) {
    return NextResponse.json(
      { message: "Passphrase auth is disabled. Use POST /api/auth/login instead." },
      { status: 410 }
    );
  }

  if (!body.passphrase || body.passphrase !== expected) {
    return NextResponse.json({ message: "Invalid passphrase" }, { status: 401 });
  }

  console.warn("[auth] COMMUNITY_PASSPHRASE is deprecated — please migrate to /api/auth/login");
  const token = signToken({ nodeId: NODE_ID, role: "auditor" });
  return NextResponse.json({ token, deprecated: true, message: "Use POST /api/auth/login" });
}
