import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, requireRole, auditorId } from "@/lib/auth";
import type { SignalStatus } from "@prisma/client";


export const dynamic = "force-dynamic";
const VALID_STATUS = new Set<SignalStatus>([
  "OPEN",
  "IN_PROGRESS",
  "RESOLVED",
  "DISMISSED",
]);

// PATCH /api/admin/signals/:id
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await requireRole(req, "AUDITOR");
  if (authError) return authError;

  const { id } = await params;

  const authUser = await getAuthUser(req);
  if (!authUser) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  let body: { status?: string; resolution?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }

  const status = body.status?.toUpperCase() as SignalStatus | undefined;
  if (!status || !VALID_STATUS.has(status)) {
    return NextResponse.json({ message: "Invalid status" }, { status: 422 });
  }

  const existing = await prisma.communitySignal.findUnique({
    where: { id },
  });
  if (!existing) {
    return NextResponse.json({ message: "Signal not found" }, { status: 404 });
  }

  const resolver = auditorId(authUser);
  const updated = await prisma.communitySignal.update({
    where: { id },
    data: {
      status,
      resolution: body.resolution?.trim() || null,
      resolvedBy: status === "RESOLVED" || status === "DISMISSED" ? resolver : null,
      resolvedAt: status === "RESOLVED" || status === "DISMISSED" ? new Date() : null,
    },
    include: {
      property: { select: { id: true, name: true, location: true } },
    },
  });

  return NextResponse.json({ ok: true, signal: updated });
}
