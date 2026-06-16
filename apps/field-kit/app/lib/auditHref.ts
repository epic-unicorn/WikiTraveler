import { ENV_NODE_URL } from "./fieldKitApi";

/** Build audit page URL; include ?node= when the property lives on a peer. */
export function auditHref(
  id: string,
  propertyNodeUrl: string,
  homeNodeUrl: string = ENV_NODE_URL
): string {
  const nodeParam =
    propertyNodeUrl !== homeNodeUrl ? `?node=${encodeURIComponent(propertyNodeUrl)}` : "";
  return `/audit/${id}${nodeParam}`;
}
