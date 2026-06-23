import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import type { NextRequest } from "next/server";

const VALID_ROLES = ["USER", "AUDITOR", "ADMIN"] as const;

interface UsersImport {
  users?: Array<{
    username: string;
    role?: string;
    password?: string;
  }>;
}

/**
 * POST /api/admin/users/import
 * Body: { users: [{ username, role, password? }] }
 * Creates missing users; updates role if user exists. Password required for new users.
 */
export async function POST(req: NextRequest) {
  const authError = await requireRole(req, "ADMIN");
  if (authError) return authError;

  let data: UsersImport;
  try {
    data = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }

  if (!Array.isArray(data.users)) {
    return NextResponse.json({ message: "users[] required" }, { status: 400 });
  }

  let created = 0;
  let updated = 0;
  const errors: string[] = [];

  for (const u of data.users) {
    if (!u.username?.trim()) {
      errors.push("Skipped entry with empty username");
      continue;
    }
    const role = VALID_ROLES.includes(u.role as (typeof VALID_ROLES)[number])
      ? (u.role as (typeof VALID_ROLES)[number])
      : "USER";

    const existing = await prisma.user.findUnique({ where: { username: u.username } });
    if (existing) {
      if (existing.role !== role) {
        await prisma.user.update({ where: { username: u.username }, data: { role } });
        updated++;
      }
      continue;
    }

    if (!u.password || u.password.length < 8) {
      errors.push(`New user "${u.username}" needs a password (min 8 chars)`);
      continue;
    }

    const passwordHash = await hash(u.password, 10);
    await prisma.user.create({ data: { username: u.username, passwordHash, role } });
    created++;
  }

  return NextResponse.json({ ok: true, created, updated, errors });
}
