import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import type { NextRequest } from "next/server";

const VALID_ROLES = ["USER", "AUDITOR", "ADMIN"] as const;
type Role = typeof VALID_ROLES[number];

/**
 * PATCH /api/admin/users/:username
 * Change a user's role. Admin only.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { username: string } }
) {
  const authError = await requireRole(req, "ADMIN");
  if (authError) return authError;

  let body: { role?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }

  const newRole = body.role?.toUpperCase();
  if (!newRole || !VALID_ROLES.includes(newRole as Role)) {
    return NextResponse.json(
      { message: `role must be one of: ${VALID_ROLES.join(", ")}` },
      { status: 422 }
    );
  }

  const user = await prisma.user.findUnique({ where: { username: params.username } });
  if (!user) {
    return NextResponse.json({ message: "User not found" }, { status: 404 });
  }

  const updated = await prisma.user.update({
    where: { username: params.username },
    data: { role: newRole as Role },
    select: { username: true, role: true },
  });

  return NextResponse.json({ ok: true, user: updated });
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
