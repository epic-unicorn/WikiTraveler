import { decodeAuthCookie } from "@/lib/authCookie";

const STORAGE_KEY = "wt_node_token";

/** JWT from session storage or auth cookie (client-only). */
export function readNodeClientToken(): string | null {
  if (typeof window === "undefined") return null;

  let stored = sessionStorage.getItem(STORAGE_KEY);
  if (!stored) {
    const m = document.cookie.match(/(?:^|;\s*)wt_token=([^;]+)/);
    if (m) {
      stored = decodeAuthCookie(m[1]);
      if (stored) sessionStorage.setItem(STORAGE_KEY, stored);
    }
  }
  return stored;
}
