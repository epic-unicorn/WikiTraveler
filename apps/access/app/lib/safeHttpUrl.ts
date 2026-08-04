/**
 * Normalize a user-supplied node base URL to `http(s)://host[:port]`.
 * Rejects non-http(s) schemes (e.g. javascript:) so values from inputs /
 * storage are safe to put in links and fetches.
 */
export function normalizeNodeBaseUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const u = new URL(trimmed);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (u.username || u.password) return null;
    return `${u.protocol}//${u.host}`;
  } catch {
    return null;
  }
}

/** Encode a property id for use in a path segment. */
export function safePathId(id: string): string {
  return encodeURIComponent(id);
}
