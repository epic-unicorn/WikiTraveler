/** Hostnames that must never be fetched as federation peers. */
const BLOCKED_HOSTS = new Set([
  "metadata",
  "metadata.google.internal",
  "kubernetes.default.svc",
]);

function isPrivateIpv4(host: string): boolean {
  const parts = host.split(".");
  if (parts.length !== 4) return false;
  const nums = parts.map((p) => Number(p));
  if (nums.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return false;
  const [a, b] = nums;
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

function isPrivateIpv6(host: string): boolean {
  const h = host.toLowerCase();
  return (
    h === "::1"
    || h === "::"
    || h.startsWith("fc")
    || h.startsWith("fd")
    || h.startsWith("fe80")
  );
}

/** Dev/gossip lab may use localhost and docker-internal hostnames. */
export function isPeerFetchDevMode(): boolean {
  return process.env.GOSSIP_DEV === "true" || process.env.NODE_ENV !== "production";
}

export type PeerUrlValidation =
  | { ok: true; url: string }
  | { ok: false; reason: string };

/**
 * Validate a federation peer base URL before any outbound fetch (SSRF guard).
 * Returns a normalized origin (no path, no trailing slash).
 */
export function validatePeerBaseUrl(raw: string): PeerUrlValidation {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, reason: "URL is required" };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, reason: "Invalid URL" };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, reason: "Peer URL must use http or https" };
  }

  if (parsed.username || parsed.password) {
    return { ok: false, reason: "Peer URL must not include credentials" };
  }

  const host = parsed.hostname.toLowerCase();
  if (BLOCKED_HOSTS.has(host)) {
    return { ok: false, reason: "Peer URL host is not allowed" };
  }

  const dev = isPeerFetchDevMode();
  if (!dev) {
    if (host === "localhost" || host.endsWith(".localhost")) {
      return { ok: false, reason: "localhost peers are not allowed in production" };
    }
    if (isPrivateIpv4(host) || isPrivateIpv6(host)) {
      return { ok: false, reason: "Private-network peer URLs are not allowed in production" };
    }
  }

  const port = parsed.port ? `:${parsed.port}` : "";
  return { ok: true, url: `${parsed.protocol}//${parsed.hostname}${port}` };
}

/** Build a validated peer API URL (path must be a fixed suffix, not user input). */
export function peerApiUrl(baseUrl: string, path: string): string | null {
  const validated = validatePeerBaseUrl(baseUrl);
  if (!validated.ok) return null;
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${validated.url}${suffix}`;
}
