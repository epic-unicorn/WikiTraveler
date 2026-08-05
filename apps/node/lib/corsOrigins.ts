/**
 * Trusted browser client origins for CORS (RFC-0002 M1).
 *
 * Allowlist = CORS_ORIGINS ∪ CLIENT_ORIGINS ∪ origin(ACCESS_PUBLIC_URL).
 * `CORS_ORIGINS=*` keeps allow-all (local/dev). Gossip-advertised accessUrl
 * values are NOT trusted automatically (phishing / H2).
 */

const ALLOW_METHODS = "GET,POST,PATCH,DELETE,OPTIONS";
const ALLOW_HEADERS = "Content-Type, Authorization";

export function splitOriginList(raw: string | undefined | null): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Normalize to a comparable origin, or null if invalid / unsupported. */
export function normalizeClientOrigin(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed === "*") return "*";

  try {
    const url = new URL(trimmed);
    if (url.protocol === "http:" || url.protocol === "https:") {
      return url.origin;
    }
    if (url.protocol === "chrome-extension:" || url.protocol === "moz-extension:") {
      // extension origins have no meaningful path for CORS matching
      return `${url.protocol}//${url.host}`;
    }
    return null;
  } catch {
    return null;
  }
}

export function collectTrustedClientOrigins(env: NodeJS.ProcessEnv = process.env): {
  allowAll: boolean;
  origins: Set<string>;
} {
  const origins = new Set<string>();
  let allowAll = false;

  const add = (raw: string) => {
    const n = normalizeClientOrigin(raw);
    if (!n) return;
    if (n === "*") {
      allowAll = true;
      return;
    }
    origins.add(n);
  };

  for (const part of splitOriginList(env.CORS_ORIGINS)) add(part);
  for (const part of splitOriginList(env.CLIENT_ORIGINS)) add(part);
  if (env.ACCESS_PUBLIC_URL?.trim()) add(env.ACCESS_PUBLIC_URL);

  // Historic default when unset: allow all (matches previous `CORS_ORIGINS ?? "*"`).
  if (env.CORS_ORIGINS === undefined) {
    allowAll = true;
  }

  return { allowAll, origins };
}

/** Origins this node advertises on nodeinfo (hubs / directory) — not a CORS trust source for peers. */
export function getAdvertisedClientOrigins(env: NodeJS.ProcessEnv = process.env): string[] {
  const out = new Set<string>();
  for (const part of splitOriginList(env.CLIENT_ORIGINS)) {
    const n = normalizeClientOrigin(part);
    if (n && n !== "*") out.add(n);
  }
  if (env.ACCESS_PUBLIC_URL?.trim()) {
    const n = normalizeClientOrigin(env.ACCESS_PUBLIC_URL);
    if (n && n !== "*") out.add(n);
  }
  return [...out].sort();
}

export function getAdvertisedAccessUrl(env: NodeJS.ProcessEnv = process.env): string | null {
  if (!env.ACCESS_PUBLIC_URL?.trim()) return null;
  const n = normalizeClientOrigin(env.ACCESS_PUBLIC_URL);
  return n && n !== "*" ? n : null;
}

/**
 * Decide Access-Control-Allow-Origin for a request Origin.
 * Returns null when the Origin must not be reflected (omit header / deny browser).
 */
export function resolveAllowOrigin(
  requestOrigin: string | null | undefined,
  env: NodeJS.ProcessEnv = process.env
): string | null {
  const { allowAll, origins } = collectTrustedClientOrigins(env);

  if (allowAll) {
    // Reflect a concrete Origin when present so credentialed clients work; else *.
    if (requestOrigin) {
      const n = normalizeClientOrigin(requestOrigin);
      return n && n !== "*" ? n : "*";
    }
    return "*";
  }

  if (!requestOrigin) return null;
  const n = normalizeClientOrigin(requestOrigin);
  if (!n || n === "*") return null;
  return origins.has(n) ? n : null;
}

export function applyCorsHeaders(
  headers: Headers,
  requestOrigin: string | null | undefined,
  env: NodeJS.ProcessEnv = process.env
): boolean {
  const allow = resolveAllowOrigin(requestOrigin, env);
  headers.set("Access-Control-Allow-Methods", ALLOW_METHODS);
  headers.set("Access-Control-Allow-Headers", ALLOW_HEADERS);
  headers.set("Vary", "Origin");
  if (allow) {
    headers.set("Access-Control-Allow-Origin", allow);
    return true;
  }
  return false;
}

export { ALLOW_METHODS, ALLOW_HEADERS };
