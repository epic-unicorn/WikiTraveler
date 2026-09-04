import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getAuthUser, type AuthUser } from "@/lib/auth";
import { NODE_URL } from "@/lib/nodeInfo";
import { prisma } from "@/lib/prisma";

export const A11Y_PREFERENCE_KEYS = [
  "step_free_entrance",
  "parking_accessible",
  "elevator_present",
  "accessible_bathroom",
  "hearing_loop",
  "braille_signage",
  "visual_alarms",
  "ramp_present",
] as const;

export type A11yPreferenceKey = (typeof A11Y_PREFERENCE_KEYS)[number];

export const THEME_VALUES = ["light", "dark", "contrast", "calm"] as const;
export type ThemeValue = (typeof THEME_VALUES)[number];

export const MAX_FAVORITES = 100;

export type FavoritePlaceInput = {
  id: string;
  name: string;
  location?: string;
  nodeUrl: string;
  savedAt?: string;
  imageUrl?: string | null;
  category?: string | null;
  facts?: unknown;
};

function normalizeUrl(url: string): string {
  return url.trim().replace(/\/$/, "").toLowerCase();
}

/** Profile data lives on the account's home node only. */
export function isHomeNodeToken(user: AuthUser): boolean {
  if (!user.homeNodeUrl) return true;
  return normalizeUrl(user.homeNodeUrl) === normalizeUrl(NODE_URL);
}

export async function requireHomeUser(
  req: NextRequest
): Promise<{ user: AuthUser; dbUser: { id: string; username: string } } | NextResponse> {
  const authUser = await getAuthUser(req);
  if (!authUser) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  if (!isHomeNodeToken(authUser)) {
    return NextResponse.json(
      { message: "Profile sync is only available on your home node" },
      { status: 403 }
    );
  }
  const dbUser = await prisma.user.findUnique({
    where: { username: authUser.username },
    select: { id: true, username: true },
  });
  if (!dbUser) {
    return NextResponse.json({ message: "User not found" }, { status: 404 });
  }
  return { user: authUser, dbUser };
}

export function parseA11yPreferences(raw: unknown): A11yPreferenceKey[] {
  if (!Array.isArray(raw)) return [];
  const allowed = new Set<string>(A11Y_PREFERENCE_KEYS);
  const out: A11yPreferenceKey[] = [];
  for (const item of raw) {
    if (typeof item === "string" && allowed.has(item) && !out.includes(item as A11yPreferenceKey)) {
      out.push(item as A11yPreferenceKey);
    }
  }
  return out;
}

export function parseTheme(raw: unknown): ThemeValue | null {
  if (raw == null || raw === "") return null;
  if (typeof raw !== "string") return null;
  return (THEME_VALUES as readonly string[]).includes(raw) ? (raw as ThemeValue) : null;
}

export function serializeFavorite(row: {
  propertyId: string;
  name: string;
  location: string;
  nodeUrl: string;
  savedAt: Date;
  imageUrl: string | null;
  category: string | null;
  facts: unknown;
}) {
  return {
    id: row.propertyId,
    name: row.name,
    location: row.location,
    nodeUrl: row.nodeUrl,
    savedAt: row.savedAt.toISOString(),
    imageUrl: row.imageUrl,
    category: row.category ?? undefined,
    facts: Array.isArray(row.facts) ? row.facts : undefined,
  };
}

export function normalizeFavoriteInput(raw: unknown): FavoritePlaceInput | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id.trim() : "";
  const name = typeof o.name === "string" ? o.name.trim() : "";
  const nodeUrl = typeof o.nodeUrl === "string" ? o.nodeUrl.trim().replace(/\/$/, "") : "";
  if (!id || !name || !nodeUrl) return null;
  const location = typeof o.location === "string" ? o.location : "";
  const savedAt = typeof o.savedAt === "string" ? o.savedAt : undefined;
  const imageUrl =
    o.imageUrl === null ? null : typeof o.imageUrl === "string" ? o.imageUrl : undefined;
  const category = typeof o.category === "string" ? o.category : o.category === null ? null : undefined;
  const facts = Array.isArray(o.facts) ? o.facts : undefined;
  return { id, name, location, nodeUrl, savedAt, imageUrl, category, facts };
}
