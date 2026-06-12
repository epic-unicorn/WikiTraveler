import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { getClientIp, getRateLimitProfile } from "@/lib/rateLimitRoutes";

// Paths that don't require a login cookie
const SKIP_PREFIXES = ["/_next/", "/api/", "/.well-known/"];
const SKIP_EXACT = new Set(["/login", "/register", "/setup", "/favicon.ico"]);

// Rate limiters — created once per cold start; null when Upstash is not configured.
// Graceful degradation: if env vars are absent, rate limiting is simply skipped.
let authLimiter: Ratelimit | null = null;
let auditLimiter: Ratelimit | null = null;

function getLimiters(): { auth: Ratelimit | null; audit: Ratelimit | null } {
  if (
    !process.env.UPSTASH_REDIS_REST_URL ||
    !process.env.UPSTASH_REDIS_REST_TOKEN
  ) {
    return { auth: null, audit: null };
  }
  if (!authLimiter) {
    const redis = Redis.fromEnv();
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
  }
  return { auth: authLimiter, audit: auditLimiter! };
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const method = req.method;

  // ── Rate limiting ─────────────────────────────────────────────────────────
  // Only applies when UPSTASH_REDIS_REST_URL / _TOKEN are set.
  const { auth: al, audit: audl } = getLimiters();
  if (al && audl) {
    const profile = getRateLimitProfile(pathname, method);
    const limiter =
      profile === "auth" ? al : profile === "audit" ? audl : null;
    if (limiter) {
      const ip = getClientIp(req.headers);
      const { success, reset } = await limiter.limit(ip);
      if (!success) {
        const retryAfter = Math.ceil((reset - Date.now()) / 1000);
        return NextResponse.json(
          { message: "Too many requests. Please try again later." },
          {
            status: 429,
            headers: {
              "Retry-After": String(retryAfter),
              "X-RateLimit-Reset": String(reset),
            },
          }
        );
      }
    }
  }

  if (
    SKIP_EXACT.has(pathname) ||
    SKIP_PREFIXES.some((p) => pathname.startsWith(p))
  ) {
    return NextResponse.next();
  }

  // ── Setup gate: redirect to /setup when no admin exists yet ──────────────
  // We call the local /api/setup endpoint so the check runs in the Edge
  // runtime without a direct Prisma connection.
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
