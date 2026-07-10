/** Hostnames that must never be fetched as federation peers. */
const BLOCKED_HOSTS = new Set([
  "metadata",
  "metadata.google.internal",
  "kubernetes.default.svc",
]);

/** Fixed API paths — not derived from user input. */
export const PEER_FETCH_PATHS = {
  nodeinfo: "/api/nodeinfo",
  pubkey: "/.well-known/pubkey",
  gossipSnapshot: "/api/gossip/snapshot",
  inbox: "/api/inbox",
} as const;

export type PeerFetchPath = (typeof PEER_FETCH_PATHS)[keyof typeof PEER_FETCH_PATHS];

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

function isHostAllowed(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (BLOCKED_HOSTS.has(host)) return false;
  if (isPeerFetchDevMode()) return true;
  if (host === "localhost" || host.endsWith(".localhost")) return false;
  if (isPrivateIpv4(host) || isPrivateIpv6(host)) return false;
  return true;
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

  if (!isHostAllowed(parsed.hostname)) {
    return { ok: false, reason: "Peer URL host is not allowed" };
  }

  const port = parsed.port ? `:${parsed.port}` : "";
  return { ok: true, url: `${parsed.protocol}//${parsed.hostname}${port}` };
}

/** Build request URL from validated origin + fixed path (SSRF-safe construction). */
function buildPeerRequestUrl(origin: string, path: PeerFetchPath): string | null {
  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  if (!isHostAllowed(parsed.hostname)) return null;

  const safeOrigin = `${parsed.protocol}//${parsed.hostname}${parsed.port ? `:${parsed.port}` : ""}`;

  switch (path) {
    case PEER_FETCH_PATHS.nodeinfo:
      return new URL(PEER_FETCH_PATHS.nodeinfo, safeOrigin).href;
    case PEER_FETCH_PATHS.pubkey:
      return new URL(PEER_FETCH_PATHS.pubkey, safeOrigin).href;
    case PEER_FETCH_PATHS.gossipSnapshot:
      return new URL(PEER_FETCH_PATHS.gossipSnapshot, safeOrigin).href;
    case PEER_FETCH_PATHS.inbox:
      return new URL(PEER_FETCH_PATHS.inbox, safeOrigin).href;
    default:
      return null;
  }
}

/**
 * Fetch a fixed peer API path after SSRF validation.
 * All outbound federation HTTP calls must use this helper.
 */
export async function fetchPeerPath(
  rawUrl: string,
  path: PeerFetchPath,
  init?: RequestInit
): Promise<Response | null> {
  const validated = validatePeerBaseUrl(rawUrl);
  if (!validated.ok) return null;

  const requestUrl = buildPeerRequestUrl(validated.url, path);
  if (!requestUrl) return null;

  try {
    return await fetch(requestUrl, {
      cache: "no-store",
      ...init,
    });
  } catch {
    return null;
  }
}

export async function fetchPeerJson<T>(
  rawUrl: string,
  path: PeerFetchPath,
  init?: RequestInit
): Promise<T | null> {
  const res = await fetchPeerPath(rawUrl, path, init);
  if (!res?.ok) return null;
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** @deprecated Use fetchPeerPath — kept for callers that only need the URL string. */
export function peerApiUrl(baseUrl: string, path: PeerFetchPath): string | null {
  const validated = validatePeerBaseUrl(baseUrl);
  if (!validated.ok) return null;
  return buildPeerRequestUrl(validated.url, path);
}
