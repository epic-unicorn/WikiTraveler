import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { getClientIp, getRateLimitProfile } from "@/lib/rateLimitRoutes";
import { decodeAuthCookie, looksLikeJwt } from "@/lib/authCookie";
import { canAccessDashboard, roleFromToken } from "@/lib/userRole";
import { applyCorsHeaders } from "@/lib/corsOrigins";
import { createUpstashRedis } from "@/lib/upstashRedis";

// Paths that don't require a login cookie
const SKIP_PREFIXES = ["/_next/", "/api/", "/.well-known/"];
const SKIP_EXACT = new Set(["/login", "/register", "/setup", "/accessibility", "/favicon.ico"]);

// Rate limiters — created once per cold start; null when Upstash is not configured.
// Graceful degradation: if env vars are absent, rate limiting is simply skipped.
// Accepts UPSTASH_REDIS_REST_* or Vercel Marketplace KV_REST_API_*.
let authLimiter: Ratelimit | null = null;
let auditLimiter: Ratelimit | null = null;
let signalLimiter: Ratelimit | null = null;

function getLimiters(): {
  auth: Ratelimit | null;
  audit: Ratelimit | null;
  signal: Ratelimit | null;
} {
  if (authLimiter && auditLimiter && signalLimiter) {
    return { auth: authLimiter, audit: auditLimiter, signal: signalLimiter };
  }
  const redis = createUpstashRedis();
  if (!redis) {
    return { auth: null, audit: null, signal: null };
  }
  authLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, "60 s"),
    prefix: "wt:rl:auth",
  });
  auditLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(20, "60 s"),
    prefix: "wt:rl:audit",
  });
  signalLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, "60 s"),
    prefix: "wt:rl:signal",
  });
  return { auth: authLimiter, audit: auditLimiter, signal: signalLimiter };
}

function withApiCors(req: NextRequest, res: NextResponse): NextResponse {
  if (req.nextUrl.pathname.startsWith("/api/")) {
    applyCorsHeaders(res.headers, req.headers.get("origin"));
  }
  return res;
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const method = req.method;
  const isApi = pathname.startsWith("/api/");

  // ── CORS preflight (browser clients: Access, Lens, SDK) ───────────────────
  if (isApi && method === "OPTIONS") {
    const res = new NextResponse(null, { status: 204 });
    applyCorsHeaders(res.headers, req.headers.get("origin"));
    return res;
  }

  // ── Rate limiting ─────────────────────────────────────────────────────────
  // Only when UPSTASH_REDIS_REST_* or Vercel KV_REST_API_* are set.
  const { auth: al, audit: audl, signal: sigl } = getLimiters();
  if (al && audl && sigl) {
    const profile = getRateLimitProfile(pathname, method);
    const limiter =
      profile === "auth"
        ? al
        : profile === "audit"
          ? audl
          : profile === "signal"
            ? sigl
            : null;
    if (limiter) {
      const ip = getClientIp(req.headers);
      const { success, reset } = await limiter.limit(ip);
      if (!success) {
        const retryAfter = Math.ceil((reset - Date.now()) / 1000);
        const res = NextResponse.json(
          { message: "Too many requests. Please try again later." },
          {
            status: 429,
            headers: {
              "Retry-After": String(retryAfter),
              "X-RateLimit-Reset": String(reset),
            },
          }
        );
        return withApiCors(req, res);
      }
    }
  }

  if (
    SKIP_EXACT.has(pathname) ||
    SKIP_PREFIXES.some((p) => pathname.startsWith(p))
  ) {
    return withApiCors(req, NextResponse.next());
  }

  // ── Setup gate: redirect to /setup when no admin exists yet ──────────────
  // Call the local /api/setup endpoint so the check avoids a direct Prisma
  // connection from the proxy layer.
  try {
    const setupUrl = new URL("/api/setup", req.url);
    const setupRes = await fetch(setupUrl, { method: "GET" });
    if (setupRes.ok) {
      const { needed } = (await setupRes.json()) as { needed: boolean };
      if (needed && pathname !== "/setup") {
        return NextResponse.redirect(new URL("/setup", req.url));
      }
    }
  } catch {
    // If the DB is unreachable during setup check, fall through to auth check
  }

  // ── Auth gate ─────────────────────────────────────────────────────────────
  const raw = req.cookies.get("wt_token")?.value;
  const token = decodeAuthCookie(raw);
  if (!token || !looksLikeJwt(token)) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    if (pathname !== "/") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (!canAccessDashboard(roleFromToken(token))) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    const res = NextResponse.redirect(url);
    res.cookies.set("wt_token", "", { path: "/", maxAge: 0 });
    return res;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
