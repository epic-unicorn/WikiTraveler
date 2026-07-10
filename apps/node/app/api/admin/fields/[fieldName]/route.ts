import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { NODE_ID } from "@/lib/nodeInfo";
import type { NextRequest } from "next/server";


export { dynamic } from "@/lib/apiRoute";
// PATCH /api/admin/fields/:fieldName
export async function PATCH(
  req: NextRequest,
  { params }: { params: { fieldName: string } }
) {
  const authError = await requireRole(req, "ADMIN");
  if (authError) return authError;

  const field = await prisma.fieldDefinition.findUnique({
    where: { fieldName: params.fieldName },
  });
  if (!field || field.nodeId !== NODE_ID) {
    return NextResponse.json({ message: "Custom field not found" }, { status: 404 });
  }

  let body: {
    labels?: Record<string, string>;
    active?: boolean;
    searchFilter?: boolean;
    enumValues?: string[];
    unit?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }

  const updated = await prisma.fieldDefinition.update({
    where: { fieldName: params.fieldName },
    data: {
      labels: body.labels ?? undefined,
      active: body.active ?? undefined,
      searchFilter: body.searchFilter ?? undefined,
      enumValues: body.enumValues ?? undefined,
      unit: body.unit ?? undefined,
    },
  });

  return NextResponse.json({ field: updated });
}

// DELETE /api/admin/fields/:fieldName — soft-delete
export async function DELETE(
  req: NextRequest,
  { params }: { params: { fieldName: string } }
) {
  const authError = await requireRole(req, "ADMIN");
  if (authError) return authError;

  const field = await prisma.fieldDefinition.findUnique({
    where: { fieldName: params.fieldName },
  });
  if (!field || field.nodeId !== NODE_ID) {
    return NextResponse.json({ message: "Custom field not found" }, { status: 404 });
  }

  await prisma.fieldDefinition.update({
    where: { fieldName: params.fieldName },
    data: { active: false },
  });

  return NextResponse.json({ message: "Field deactivated" });
}
