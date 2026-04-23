import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Paths that don't require a login cookie
const SKIP_PREFIXES = ["/_next/", "/api/", "/.well-known/"];
const SKIP_EXACT = new Set(["/login", "/register", "/favicon.ico"]);

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (SKIP_EXACT.has(pathname) || SKIP_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

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
