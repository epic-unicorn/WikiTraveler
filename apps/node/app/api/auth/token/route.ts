import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { signToken } from "@/lib/auth";
import { NODE_ID } from "@/lib/nodeInfo";

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
      { message: "Node not configured — COMMUNITY_PASSPHRASE not set" },
      { status: 503 }
    );
  }

  if (!body.passphrase || body.passphrase !== expected) {
    return NextResponse.json({ message: "Invalid passphrase" }, { status: 401 });
  }

  const token = signToken({ nodeId: NODE_ID, role: "auditor" });
  return NextResponse.json({ token });
}
