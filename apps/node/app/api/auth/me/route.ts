import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { JwtPayload } from "jsonwebtoken";
import { verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  isHomeNodeToken,
  parseA11yPreferences,
  parseTheme,
} from "@/lib/userProfile";

export const dynamic = "force-dynamic";

/**
 * GET /api/auth/me
 * Returns the authenticated user's identity (+ preferences when on home node).
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  try {
    const payload = (await verifyToken(auth.slice(7))) as JwtPayload & {
      sub?: string;
      homeNodeUrl?: string;
      role?: string;
    };
    const username = payload.sub ?? null;
    const homeNodeUrl = payload.homeNodeUrl ?? null;
    const role = payload.role ?? "USER";

    const base = { username, homeNodeUrl, role };

    if (!username || !isHomeNodeToken({ username: username.trim().toLowerCase(), role: "USER", homeNodeUrl: homeNodeUrl ?? undefined })) {
      return NextResponse.json(base);
    }

    const user = await prisma.user.findUnique({
      where: { username: username.trim().toLowerCase() },
      select: {
        a11yPreferences: true,
        theme: true,
        preferencesUpdatedAt: true,
      },
    });
    if (!user) {
      return NextResponse.json(base);
    }

    return NextResponse.json({
      ...base,
      preferences: {
        a11yPreferences: parseA11yPreferences(user.a11yPreferences),
        theme: parseTheme(user.theme),
        updatedAt: user.preferencesUpdatedAt.toISOString(),
      },
    });
  } catch {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
}
