import { ENV_NODE_URL } from "./accessApi";
import { auditHref } from "./auditHref";

/** Build property detail URL; include ?node= when the property lives on a peer. */
export function propertyHref(
  id: string,
  propertyNodeUrl: string,
  homeNodeUrl: string = ENV_NODE_URL
): string {
  const nodeParam =
    propertyNodeUrl !== homeNodeUrl ? `?node=${encodeURIComponent(propertyNodeUrl)}` : "";
  return `/properties/${id}${nodeParam}`;
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
