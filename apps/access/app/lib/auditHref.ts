import { ENV_NODE_URL } from "./accessApi";
import { normalizeNodeBaseUrl, safePathId } from "./safeHttpUrl";

/** Build audit page URL; include ?node= when the property lives on a peer. */
export function auditHref(
  id: string,
  propertyNodeUrl: string,
  homeNodeUrl: string = ENV_NODE_URL
): string {
  const path = `/audit/${safePathId(id)}`;
  const peer = normalizeNodeBaseUrl(propertyNodeUrl);
  const home = normalizeNodeBaseUrl(homeNodeUrl) ?? homeNodeUrl;
  if (!peer || peer === home) return path;
  return `${path}?node=${encodeURIComponent(peer)}`;
}
