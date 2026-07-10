import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { NODE_ID } from "@/lib/nodeInfo";
import type { NextRequest } from "next/server";
import type { FieldScope, ValueType } from "@prisma/client";


export { dynamic } from "@/lib/apiRoute";
function customFieldName(name: string): string {
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  return `custom:${NODE_ID}:${slug}`;
}

// GET /api/admin/fields
export async function GET(req: NextRequest) {
  const authError = await requireRole(req, "ADMIN");
  if (authError) return authError;

  const fields = await prisma.fieldDefinition.findMany({
    where: { OR: [{ nodeId: null }, { nodeId: NODE_ID }] },
    orderBy: [{ nodeId: "asc" }, { fieldName: "asc" }],
  });
  return NextResponse.json({ fields });
}

// POST /api/admin/fields — create node custom field
export async function POST(req: NextRequest) {
  const authError = await requireRole(req, "ADMIN");
  if (authError) return authError;

  let body: {
    name?: string;
    scope?: FieldScope;
    valueType?: ValueType;
    enumValues?: string[];
    labels?: Record<string, string>;
    unit?: string;
    searchFilter?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }

  if (!body.name?.trim() || !body.labels || Object.keys(body.labels).length === 0) {
    return NextResponse.json({ message: "name and labels are required" }, { status: 422 });
  }

  const fieldName = customFieldName(body.name);
  const existing = await prisma.fieldDefinition.findUnique({ where: { fieldName } });
  if (existing) {
    return NextResponse.json({ message: "A custom field with this name already exists" }, { status: 409 });
  }

  const field = await prisma.fieldDefinition.create({
    data: {
      fieldName,
      scope: body.scope ?? "PROPERTY",
      valueType: body.valueType ?? "TEXT",
      enumValues: body.enumValues ?? [],
      labels: body.labels,
      unit: body.unit ?? null,
      nodeId: NODE_ID,
      searchFilter: body.searchFilter ?? false,
      active: true,
    },
  });

  return NextResponse.json({ field }, { status: 201 });
}
