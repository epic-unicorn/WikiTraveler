import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signToken } from "@/lib/auth";

/**
 * POST /api/auth/login
 * Exchange username + password for a 30-day RS256 JWT.
 * The JWT contains { sub: username, homeNodeUrl, role: "auditor" }.
 */
export async function POST(req: Request) {
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

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) {
    // Constant-time: still run bcrypt to avoid timing attacks
    await bcrypt.compare(password, "$2b$12$invalidsaltthatisusedtofailfast");
    return NextResponse.json({ message: "Invalid credentials" }, { status: 401 });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return NextResponse.json({ message: "Invalid credentials" }, { status: 401 });
  }

  const token = signToken({ sub: username, role: user.role });
  return NextResponse.json({ token, username, role: user.role });
}
