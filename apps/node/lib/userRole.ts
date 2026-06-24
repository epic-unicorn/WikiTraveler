import type { Role } from "./auth";

/** Decode JWT payload client-side — routing / UI only, not security. */
export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    return JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/"))) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function roleFromToken(token: string | null): Role {
  if (!token) return "USER";
  const payload = decodeJwtPayload(token);
  const role = (payload?.role as string | undefined)?.toUpperCase();
  if (role === "ADMIN" || role === "AUDITOR") return role;
  return "USER";
}

/** Node dashboard is for auditors and admins only. */
export function canAccessDashboard(role: Role): boolean {
  return role === "AUDITOR" || role === "ADMIN";
}

export function canContribute(role: Role): boolean {
  return canAccessDashboard(role);
}
