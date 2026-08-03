import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, auditorId, requireAuth } from "@/lib/auth";
import { NODE_URL } from "@/lib/nodeInfo";
import {
  listSignalsForProperty,
  reporterId,
  upsertCommunitySignal,
  type SignalInput,
} from "@/lib/communitySignals";
import type { SignalType } from "@prisma/client";


export const dynamic = "force-dynamic";
const VALID_TYPES = new Set<SignalType>([
  "MISSING",
  "INCORRECT",
  "OUTDATED",
  "LOCATION",
  "DEMAND",
]);

// GET /api/properties/:id/signals
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await requireAuth(req);
  if (authError) return authError;

  const { id } = await params;

  const authUser = await getAuthUser(req);
  if (!authUser) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const property = await prisma.property.findFirst({
    where: { OR: [{ id }, { canonicalId: id }] },
    select: { id: true },
  });
  if (!property) {
    return NextResponse.json({ message: "Property not found" }, { status: 404 });
  }

  const mineOnly = req.nextUrl.searchParams.get("mine") === "true";
  const rid = reporterId(authUser.username, authUser.homeNodeUrl ?? NODE_URL);

  const { signals, openCount } = await listSignalsForProperty(
    property.id,
    mineOnly ? rid : undefined
  );

  return NextResponse.json({
    signals: mineOnly
      ? signals
      : signals.map((s) => ({
          id: s.id,
          type: s.type,
          status: s.status,
          fieldName: s.fieldName,
          createdAt: s.createdAt.toISOString(),
        })),
    openCount,
  });
}

// POST /api/properties/:id/signals
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await requireAuth(req);
  if (authError) return authError;

  const { id } = await params;

  const authUser = await getAuthUser(req);
  if (!authUser) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  let body: SignalInput;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }

  const type = (body.type ?? "").toUpperCase() as SignalType;
  if (!VALID_TYPES.has(type)) {
    return NextResponse.json({ message: "Invalid signal type" }, { status: 422 });
  }

  const property = await prisma.property.findFirst({
    where: { OR: [{ id }, { canonicalId: id }] },
    select: { id: true },
  });
  if (!property) {
    return NextResponse.json({ message: "Property not found" }, { status: 404 });
  }

  const rid = reporterId(authUser.username, authUser.homeNodeUrl ?? NODE_URL);

  const recentCount = await prisma.communitySignal.count({
    where: {
      reporterId: rid,
      createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
  });
  if (recentCount >= 20) {
    return NextResponse.json(
      { message: "Daily report limit reached. Try again tomorrow." },
      { status: 429 }
    );
  }

  try {
    const signal = await upsertCommunitySignal({
      propertyId: property.id,
      reporterId: rid,
      input: { ...body, type },
    });
    return NextResponse.json({ ok: true, signal }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not save report";
    return NextResponse.json({ message: msg }, { status: 422 });
  }
}
