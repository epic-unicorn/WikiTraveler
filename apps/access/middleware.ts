import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { decodeAuthCookie, looksLikeJwt } from "./lib/authCookie";
import { roleFromToken } from "./app/lib/userRole";
import { contributorRouteRedirect } from "./lib/contributorRoutes";

const SKIP_PREFIXES = ["/_next/", "/node-api/"];
const SKIP_EXACT = new Set(["/login", "/register", "/favicon.ico"]);

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (SKIP_EXACT.has(pathname) || SKIP_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const raw = req.cookies.get("wt_token")?.value;
  const token = decodeAuthCookie(raw);
  if (!token || !looksLikeJwt(token)) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    if (pathname !== "/") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  const role = roleFromToken(token);
  const redirectPath = contributorRouteRedirect(pathname, role);
  if (redirectPath) {
    const url = req.nextUrl.clone();
    url.pathname = redirectPath;
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|node-api|favicon.ico).*)"],
};
