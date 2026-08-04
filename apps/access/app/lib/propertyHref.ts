import { ENV_NODE_URL } from "./accessApi";
import { auditHref } from "./auditHref";
import { normalizeNodeBaseUrl, safePathId } from "./safeHttpUrl";

/** Build property detail URL; include ?node= when the property lives on a peer. */
export function propertyHref(
  id: string,
  propertyNodeUrl: string,
  homeNodeUrl: string = ENV_NODE_URL
): string {
  const path = `/properties/${safePathId(id)}`;
  const peer = normalizeNodeBaseUrl(propertyNodeUrl);
  const home = normalizeNodeBaseUrl(homeNodeUrl) ?? homeNodeUrl;
  if (!peer || peer === home) return path;
  return `${path}?node=${encodeURIComponent(peer)}`;
}

/** Property detail for travelers; audit wizard for auditors/admins. */
export function propertyOrAuditHref(
  id: string,
  propertyNodeUrl: string,
  homeNodeUrl: string,
  asContributor: boolean
): string {
  return asContributor
    ? auditHref(id, propertyNodeUrl, homeNodeUrl)
    : propertyHref(id, propertyNodeUrl, homeNodeUrl);
}

export { auditHref };
