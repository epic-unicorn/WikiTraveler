export type RateLimitProfile = "auth" | "audit";

const AUTH_ROUTE = /^\/api\/auth\/(login|register)$/;
const AUDIT_ROUTE = /^\/api\/properties\/[^/]+\/accessibility$/;

/** Returns which rate-limit bucket applies, or null when the route is not limited. */
export function getRateLimitProfile(
  pathname: string,
  method: string
): RateLimitProfile | null {
  if (method !== "POST") return null;
  if (AUTH_ROUTE.test(pathname)) return "auth";
  if (AUDIT_ROUTE.test(pathname)) return "audit";
  return null;
}

export function getClientIp(headers: Headers): string {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headers.get("x-real-ip") ??
    "anonymous"
  );
}
