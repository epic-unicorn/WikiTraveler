import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyToken } from "@/lib/auth";
import type { JwtPayload } from "jsonwebtoken";

/**
 * GET /api/auth/me
 * Returns the authenticated user's identity.
 * Used by Field Kit and Lens to display the logged-in user.
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  try {
    const payload = await verifyToken(auth.slice(7)) as JwtPayload & { sub?: string; homeNodeUrl?: string; role?: string };
    return NextResponse.json({
      username: payload.sub ?? null,
      homeNodeUrl: payload.homeNodeUrl ?? null,
      role: payload.role ?? "auditor",
    });
  } catch {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
}
