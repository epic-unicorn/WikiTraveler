import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/auth/register
 * Create a new user account on this node.
 * Gated by OPEN_REGISTRATION env flag (default: true).
 */
export async function POST(req: Request) {
  const openRegistration = process.env.OPEN_REGISTRATION !== "false";
  if (!openRegistration) {
    return NextResponse.json(
      { message: "Registration is closed on this node." },
      { status: 403 }
    );
  }

  let body: { username?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }

  const username = body.username?.trim().toLowerCase();
  const password = body.password;

  if (!username || username.length < 2 || username.length > 64) {
    return NextResponse.json(
      { message: "username must be 2–64 characters" },
      { status: 422 }
    );
  }
  if (!/^[a-z0-9_.-]+$/.test(username)) {
    return NextResponse.json(
      { message: "username may only contain letters, numbers, _, ., -" },
      { status: 422 }
    );
  }
  if (!password || password.length < 8) {
    return NextResponse.json(
      { message: "password must be at least 8 characters" },
      { status: 422 }
    );
  }

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    return NextResponse.json({ message: "Username already taken" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.create({ data: { username, passwordHash } });

  return NextResponse.json({ ok: true, username }, { status: 201 });
}
