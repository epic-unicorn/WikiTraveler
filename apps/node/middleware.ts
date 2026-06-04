import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Paths that don't require a login cookie
const SKIP_PREFIXES = ["/_next/", "/api/", "/.well-known/"];
const SKIP_EXACT = new Set(["/login", "/register", "/setup", "/favicon.ico"]);

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (SKIP_EXACT.has(pathname) || SKIP_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // ── Setup gate: redirect to /setup when no admin exists yet ──────────────
  // We call the local /api/setup endpoint so the check runs in the Edge
  // runtime without a direct Prisma connection.
  try {
    const setupUrl = new URL("/api/setup", req.url);
    const setupRes = await fetch(setupUrl, { method: "GET" });
    if (setupRes.ok) {
      const { needed } = await setupRes.json() as { needed: boolean };
      if (needed && pathname !== "/setup") {
        return NextResponse.redirect(new URL("/setup", req.url));
      }
    }
  } catch {
    // If the DB is unreachable during setup check, fall through to auth check
  }

  // ── Auth gate ─────────────────────────────────────────────────────────────
  const token = req.cookies.get("wt_token")?.value;
  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    if (pathname !== "/") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
