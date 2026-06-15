const AUTH_COOKIE = "wt_token";
const AUTH_SESSION_KEY = "wt_auth_token";
const NODE_URL_KEY = "wt_node_url";
const USERNAME_KEY = "wt_username";
const MAX_AGE_SEC = 30 * 24 * 60 * 60;

export type FieldKitRole = "USER" | "AUDITOR" | "ADMIN";

export function normalizeRole(role?: string | null): FieldKitRole {
  const upper = (role ?? "USER").toUpperCase();
  if (upper === "AUDITOR" || upper === "ADMIN") return upper;
  return "USER";
}

export function canAccessFieldKit(role?: string | null): boolean {
  const normalized = normalizeRole(role);
  return normalized === "AUDITOR" || normalized === "ADMIN";
}

/** JWT may contain `=`; always URL-encode when writing document.cookie. */
export function persistAuth(token: string, username: string, nodeUrl: string) {
  document.cookie = `${AUTH_COOKIE}=${encodeURIComponent(token)}; path=/; max-age=${MAX_AGE_SEC}; SameSite=Lax`;
  sessionStorage.setItem(AUTH_SESSION_KEY, token);
  localStorage.setItem(NODE_URL_KEY, nodeUrl);
  localStorage.setItem(USERNAME_KEY, username);
}

export function clearAuth() {
  document.cookie = `${AUTH_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
  sessionStorage.removeItem(AUTH_SESSION_KEY);
  localStorage.removeItem(USERNAME_KEY);
}

export function readAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  const fromSession = sessionStorage.getItem(AUTH_SESSION_KEY);
  if (fromSession) return fromSession;
  const m = document.cookie.match(/(?:^|;\s*)wt_token=([^;]+)/);
  if (!m) return null;
  try {
    return decodeURIComponent(m[1]);
  } catch {
    return m[1];
  }
}

export { decodeAuthCookie, looksLikeJwt } from "../../lib/authCookie";
