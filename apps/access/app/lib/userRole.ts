import type { AppRole } from "./authStorage";

/** Decode JWT payload client-side — display / routing only, not security. */
export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    return JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/"))) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function roleFromToken(token: string | null): AppRole {
  if (!token) return "USER";
  const payload = decodeJwtPayload(token);
  const role = (payload?.role as string | undefined)?.toUpperCase();
  if (role === "ADMIN" || role === "AUDITOR") return role;
  return "USER";
}

export function canContribute(role: AppRole): boolean {
  return role === "AUDITOR" || role === "ADMIN";
}
