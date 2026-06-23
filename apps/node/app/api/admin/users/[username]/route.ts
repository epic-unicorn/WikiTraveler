import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import type { NextRequest } from "next/server";

const VALID_ROLES = ["USER", "AUDITOR", "ADMIN"] as const;
type Role = typeof VALID_ROLES[number];

/**
 * PATCH /api/admin/users/:username
 * Change a user's role and/or set a new password. Admin only.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { username: string } }
) {
  const authError = await requireRole(req, "ADMIN");
  if (authError) return authError;

  let body: { role?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }

  const hasRole = body.role !== undefined;
  const hasPassword = body.password !== undefined;
  if (!hasRole && !hasPassword) {
    return NextResponse.json(
      { message: "Provide role and/or password" },
      { status: 422 }
    );
  }

  const data: { role?: Role; passwordHash?: string } = {};

  if (hasRole) {
    const newRole = body.role?.toUpperCase();
    if (!newRole || !VALID_ROLES.includes(newRole as Role)) {
      return NextResponse.json(
        { message: `role must be one of: ${VALID_ROLES.join(", ")}` },
        { status: 422 }
      );
    }
    data.role = newRole as Role;
  }

  if (hasPassword) {
    if (!body.password || body.password.length < 8) {
      return NextResponse.json(
        { message: "password must be at least 8 characters" },
        { status: 422 }
      );
    }
    data.passwordHash = await hash(body.password, 12);
  }

  const user = await prisma.user.findUnique({ where: { username: params.username } });
  if (!user) {
    return NextResponse.json({ message: "User not found" }, { status: 404 });
  }

  const updated = await prisma.user.update({
    where: { username: params.username },
    data,
    select: { username: true, role: true },
  });

  return NextResponse.json({
    ok: true,
    user: updated,
    passwordUpdated: hasPassword,
  });
}

/**
 * DELETE /api/admin/users/:username
 * Delete a user account. Admin only.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { username: string } }
) {
  const authError = await requireRole(req, "ADMIN");
  if (authError) return authError;

  const user = await prisma.user.findUnique({ where: { username: params.username } });
  if (!user) {
    return NextResponse.json({ message: "User not found" }, { status: 404 });
  }

  await prisma.user.delete({ where: { username: params.username } });
  return NextResponse.json({ ok: true });
}
