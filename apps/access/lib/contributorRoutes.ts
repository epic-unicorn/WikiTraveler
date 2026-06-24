import type { AppRole } from "../app/lib/authStorage";
import { canContribute } from "../app/lib/userRole";

/** Redirect path for non-contributors on auditor-only routes, or null to allow. */
export function contributorRouteRedirect(pathname: string, role: AppRole): string | null {
  if (canContribute(role)) return null;

  if (pathname.startsWith("/audit/")) {
    const id = pathname.split("/")[2];
    if (id) return `/properties/${id}`;
  }

  if (pathname === "/properties/new") return "/";

  return null;
}
