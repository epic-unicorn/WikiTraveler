import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signToken } from "@/lib/auth";

/**
 * GET /api/setup
 * Returns { needed: true } when no admin account exists yet, { needed: false } otherwise.
 * Used by the middleware and the setup page to decide whether to show the setup flow.
 */
export async function GET() {
  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  return NextResponse.json({ needed: !admin });
}

/**
 * POST /api/setup
 * Creates the first admin account. Permanently locked once an admin exists.
 *
 * Body: { username: string, password: string }
 */
export async function POST(req: Request) {
  // Guard: refuse if any admin already exists
  const existing = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  if (existing) {
    return NextResponse.json(
      { message: "Setup already completed. An admin account already exists." },
      { status: 409 }
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

  if (!username || !password) {
    return NextResponse.json(
      { message: "username and password are required" },
      { status: 422 }
    );
  }
  if (username.length < 3) {
    return NextResponse.json(
      { message: "username must be at least 3 characters" },
      { status: 422 }
    );
  }
  if (password.length < 8) {
    return NextResponse.json(
      { message: "password must be at least 8 characters" },
      { status: 422 }
    );
  }

  const taken = await prisma.user.findUnique({ where: { username } });
  if (taken) {
    return NextResponse.json({ message: "Username already taken" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { username, passwordHash, role: "ADMIN" },
  });

  console.info(`[setup] Admin account created: ${username}`);

  // Issue a login token immediately so the browser lands on the dashboard
  const token = signToken({ sub: user.username, role: user.role });
  return NextResponse.json({ token, username: user.username, role: user.role }, { status: 201 });
}
