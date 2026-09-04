import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  parseA11yPreferences,
  parseTheme,
  requireHomeUser,
} from "@/lib/userProfile";

export const dynamic = "force-dynamic";

/**
 * PUT /api/auth/preferences
 * Body: { a11yPreferences: string[], theme?: string | null }
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
  if (!body || typeof body !== "object") {
    return NextResponse.json({ message: "Invalid body" }, { status: 400 });
  }
  const o = body as Record<string, unknown>;
  if (!("a11yPreferences" in o) || !Array.isArray(o.a11yPreferences)) {
    return NextResponse.json({ message: "a11yPreferences array required" }, { status: 422 });
  }
  const a11yPreferences = parseA11yPreferences(o.a11yPreferences);
  if (o.a11yPreferences.length > 0 && a11yPreferences.length === 0) {
    return NextResponse.json({ message: "Invalid a11yPreferences" }, { status: 422 });
  }

  let theme: string | null | undefined = undefined;
  if ("theme" in o) {
    if (o.theme === null || o.theme === "") {
      theme = null;
    } else {
      const parsed = parseTheme(o.theme);
      if (!parsed) {
        return NextResponse.json({ message: "Invalid theme" }, { status: 422 });
      }
      theme = parsed;
    }
  }

  const now = new Date();
  const updated = await prisma.user.update({
    where: { id: gate.dbUser.id },
    data: {
      a11yPreferences,
      ...(theme !== undefined ? { theme } : {}),
      preferencesUpdatedAt: now,
    },
    select: {
      a11yPreferences: true,
      theme: true,
      preferencesUpdatedAt: true,
    },
  });

  return NextResponse.json({
    preferences: {
      a11yPreferences: parseA11yPreferences(updated.a11yPreferences),
      theme: parseTheme(updated.theme),
      updatedAt: updated.preferencesUpdatedAt.toISOString(),
    },
  });
}
