import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { auditorId, getAuthUser, requireRole } from "@/lib/auth";


export const dynamic = "force-dynamic";
type RouteParams = { params: Promise<{ id: string }> };

async function findProperty(id: string) {
  return prisma.property.findFirst({
    where: { OR: [{ id }, { canonicalId: id }] },
    select: {
      id: true,
      claimedByUserId: true,
      claimedAt: true,
    },
  });
}

function claimPayload(
  property: { claimedByUserId: string | null; claimedAt: Date | null },
  me: string | null
) {
  return {
    claimedByUserId: property.claimedByUserId,
    claimedAt: property.claimedAt?.toISOString() ?? null,
    isClaimedByMe: Boolean(me && property.claimedByUserId === me),
  };
}

// POST /api/properties/:id/claim — AUDITOR/ADMIN; claim for self
export async function POST(req: NextRequest, { params }: RouteParams) {
  const authError = await requireRole(req, "AUDITOR");
  if (authError) return authError;

  const authUser = await getAuthUser(req);
  if (!authUser) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const me = auditorId(authUser);
  const { id } = await params;
  const property = await findProperty(id);
  if (!property) {
    return NextResponse.json({ message: "Property not found" }, { status: 404 });
  }

  if (
    property.claimedByUserId &&
    property.claimedByUserId !== me &&
    authUser.role !== "ADMIN"
  ) {
    return NextResponse.json(
      { message: "Property already claimed by another auditor" },
      { status: 409 }
    );
  }

  const updated = await prisma.property.update({
    where: { id: property.id },
    data: {
      claimedByUserId: me,
      claimedAt: new Date(),
    },
    select: { claimedByUserId: true, claimedAt: true },
  });

  return NextResponse.json(claimPayload(updated, me));
}

// DELETE /api/properties/:id/claim — claimer or ADMIN clears claim
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const authError = await requireRole(req, "AUDITOR");
  if (authError) return authError;

  const authUser = await getAuthUser(req);
  if (!authUser) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const me = auditorId(authUser);
  const { id } = await params;
  const property = await findProperty(id);
  if (!property) {
    return NextResponse.json({ message: "Property not found" }, { status: 404 });
  }

  if (!property.claimedByUserId) {
    return NextResponse.json(claimPayload(property, me));
  }

  if (property.claimedByUserId !== me && authUser.role !== "ADMIN") {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const updated = await prisma.property.update({
    where: { id: property.id },
    data: {
      claimedByUserId: null,
      claimedAt: null,
    },
    select: { claimedByUserId: true, claimedAt: true },
  });

  return NextResponse.json(claimPayload(updated, me));
}
