import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  MAX_FAVORITES,
  normalizeFavoriteInput,
  requireHomeUser,
  serializeFavorite,
  type FavoritePlaceInput,
} from "@/lib/userProfile";

export const dynamic = "force-dynamic";

async function listFavorites(userId: string) {
  const [rows, user] = await Promise.all([
    prisma.favorite.findMany({
      where: { userId },
      orderBy: { savedAt: "desc" },
      take: MAX_FAVORITES,
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { favoritesUpdatedAt: true },
    }),
  ]);
  return {
    places: rows.map(serializeFavorite),
    updatedAt: (user?.favoritesUpdatedAt ?? new Date()).toISOString(),
  };
}

/** GET /api/auth/favorites */
export async function GET(req: NextRequest) {
  const gate = await requireHomeUser(req);
  if (gate instanceof NextResponse) return gate;
  return NextResponse.json(await listFavorites(gate.dbUser.id));
}

/**
 * PUT /api/auth/favorites — full replace (migration / list rewrite).
 * Body: { places: FavoritePlaceInput[] }
 */
export async function PUT(req: NextRequest) {
  const gate = await requireHomeUser(req);
  if (gate instanceof NextResponse) return gate;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }
  const placesRaw =
    body && typeof body === "object" && Array.isArray((body as { places?: unknown }).places)
      ? (body as { places: unknown[] }).places
      : null;
  if (!placesRaw) {
    return NextResponse.json({ message: "places array required" }, { status: 422 });
  }

  const places: FavoritePlaceInput[] = [];
  for (const item of placesRaw.slice(0, MAX_FAVORITES)) {
    const normalized = normalizeFavoriteInput(item);
    if (normalized) places.push(normalized);
  }

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.favorite.deleteMany({ where: { userId: gate.dbUser.id } });
    if (places.length > 0) {
      await tx.favorite.createMany({
        data: places.map((p) => ({
          userId: gate.dbUser.id,
          propertyId: p.id,
          nodeUrl: p.nodeUrl,
          name: p.name,
          location: p.location ?? "",
          savedAt: p.savedAt ? new Date(p.savedAt) : now,
          imageUrl: p.imageUrl ?? null,
          category: p.category ?? null,
          facts: p.facts ?? undefined,
        })),
      });
    }
    await tx.user.update({
      where: { id: gate.dbUser.id },
      data: { favoritesUpdatedAt: now },
    });
  });

  return NextResponse.json(await listFavorites(gate.dbUser.id));
}

/**
 * POST /api/auth/favorites — upsert one place (heart toggle on).
 * Body: FavoritePlaceInput
 */
export async function POST(req: NextRequest) {
  const gate = await requireHomeUser(req);
  if (gate instanceof NextResponse) return gate;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }
  const place = normalizeFavoriteInput(body);
  if (!place) {
    return NextResponse.json({ message: "Invalid favorite" }, { status: 422 });
  }

  const count = await prisma.favorite.count({ where: { userId: gate.dbUser.id } });
  const existing = await prisma.favorite.findUnique({
    where: {
      userId_propertyId_nodeUrl: {
        userId: gate.dbUser.id,
        propertyId: place.id,
        nodeUrl: place.nodeUrl,
      },
    },
  });
  if (!existing && count >= MAX_FAVORITES) {
    return NextResponse.json({ message: "Favorite limit reached" }, { status: 422 });
  }

  const now = new Date();
  const savedAt = place.savedAt ? new Date(place.savedAt) : now;
  await prisma.$transaction(async (tx) => {
    await tx.favorite.upsert({
      where: {
        userId_propertyId_nodeUrl: {
          userId: gate.dbUser.id,
          propertyId: place.id,
          nodeUrl: place.nodeUrl,
        },
      },
      create: {
        userId: gate.dbUser.id,
        propertyId: place.id,
        nodeUrl: place.nodeUrl,
        name: place.name,
        location: place.location ?? "",
        savedAt,
        imageUrl: place.imageUrl ?? null,
        category: place.category ?? null,
        facts: place.facts ?? undefined,
      },
      update: {
        name: place.name,
        location: place.location ?? "",
        imageUrl: place.imageUrl ?? null,
        category: place.category ?? null,
        facts: place.facts ?? undefined,
      },
    });
    await tx.user.update({
      where: { id: gate.dbUser.id },
      data: { favoritesUpdatedAt: now },
    });
  });

  return NextResponse.json({ ok: true, ...(await listFavorites(gate.dbUser.id)) }, { status: 201 });
}

/**
 * DELETE /api/auth/favorites?propertyId=&nodeUrl=
 */
export async function DELETE(req: NextRequest) {
  const gate = await requireHomeUser(req);
  if (gate instanceof NextResponse) return gate;

  const url = new URL(req.url);
  const propertyId = url.searchParams.get("propertyId")?.trim() ?? "";
  const nodeUrl = (url.searchParams.get("nodeUrl") ?? "").trim().replace(/\/$/, "");
  if (!propertyId || !nodeUrl) {
    return NextResponse.json({ message: "propertyId and nodeUrl required" }, { status: 422 });
  }

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.favorite.deleteMany({
      where: { userId: gate.dbUser.id, propertyId, nodeUrl },
    });
    await tx.user.update({
      where: { id: gate.dbUser.id },
      data: { favoritesUpdatedAt: now },
    });
  });

  return NextResponse.json({ ok: true, ...(await listFavorites(gate.dbUser.id)) });
}
