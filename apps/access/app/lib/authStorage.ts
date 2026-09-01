import { ENV_NODE_URL } from "./accessApi";
import { normalizeNodeBaseUrl } from "./safeHttpUrl";

const AUTH_COOKIE = "wt_token";
const NODE_URL_COOKIE = "wt_node_url";
const AUTH_SESSION_KEY = "wt_auth_token";
const NODE_URL_KEY = "wt_node_url";
const USERNAME_KEY = "wt_username";
const MAX_AGE_SEC = 30 * 24 * 60 * 60;

/** Fired after login / logout so per-user local state can reload. */
export const AUTH_CHANGED_EVENT = "wt-auth-changed";

function emitAuthChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
}

/** Mirror configured node URL into a cookie so SSR audit pages hit the right node. */
export function persistNodeUrlCookie(nodeUrl: string) {
  const safe = normalizeNodeBaseUrl(nodeUrl);
  if (!safe) return;
  document.cookie = `${NODE_URL_COOKIE}=${encodeURIComponent(safe)}; path=/; max-age=${MAX_AGE_SEC}; SameSite=Lax`;
}

export function readNodeUrlCookie(raw?: string | null): string | null {
  if (!raw) return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export type AppRole = "USER" | "AUDITOR" | "ADMIN";

/** @deprecated use AppRole */
export type AccessLegacyRole = AppRole;

export function normalizeRole(role?: string | null): AppRole {
  const upper = (role ?? "USER").toUpperCase();
  if (upper === "AUDITOR" || upper === "ADMIN") return upper;
  return "USER";
}

/** All authenticated roles may use WikiTraveler Access. */
export function canAccessApp(role?: string | null): boolean {
  const normalized = normalizeRole(role);
  return normalized === "USER" || normalized === "AUDITOR" || normalized === "ADMIN";
}

/** JWT may contain `=`; always URL-encode when writing document.cookie. */
export function persistAuth(token: string, username: string, nodeUrl: string) {
  const safeNodeUrl = normalizeNodeBaseUrl(nodeUrl) ?? ENV_NODE_URL;
  document.cookie = `${AUTH_COOKIE}=${encodeURIComponent(token)}; path=/; max-age=${MAX_AGE_SEC}; SameSite=Lax`;
  persistNodeUrlCookie(safeNodeUrl);
  sessionStorage.setItem(AUTH_SESSION_KEY, token);
  localStorage.setItem(NODE_URL_KEY, safeNodeUrl);
  localStorage.setItem(USERNAME_KEY, username);
  emitAuthChanged();
}

export function clearAuth() {
  document.cookie = `${AUTH_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
  document.cookie = `${NODE_URL_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
  sessionStorage.removeItem(AUTH_SESSION_KEY);
  localStorage.removeItem(USERNAME_KEY);
  emitAuthChanged();
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

export function readUsername(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(USERNAME_KEY);
}

export { decodeAuthCookie, looksLikeJwt } from "../../lib/authCookie";
