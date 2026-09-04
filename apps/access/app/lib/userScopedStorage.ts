/** Per-account localStorage so favorites / prefs do not leak across logins. */

type Envelope<T> = { byUser: Record<string, T> };

function isEnvelope<T>(value: unknown): value is Envelope<T> {
  return (
    !!value &&
    typeof value === "object" &&
    "byUser" in value &&
    typeof (value as Envelope<T>).byUser === "object" &&
    (value as Envelope<T>).byUser !== null &&
    !Array.isArray((value as Envelope<T>).byUser)
  );
}

function hasStorage(): boolean {
  try {
    return typeof localStorage !== "undefined";
  } catch {
    return false;
  }
}

/**
 * Cache identity: prefer `username@homeNodeUrl` when the node URL is known,
 * falling back to bare username (legacy envelopes are migrated on read/write).
 */
export function currentStorageUser(): string | null {
  if (!hasStorage()) return null;
  const raw = localStorage.getItem("wt_username");
  const user = raw?.trim().toLowerCase();
  if (!user) return null;
  const node = (localStorage.getItem("wt_node_url") ?? "").trim().replace(/\/$/, "").toLowerCase();
  if (!node) return user;
  // Already stored as user@node
  if (user.includes("@")) return user;
  return `${user}@${node}`;
}

function legacyBareUser(scoped: string): string | null {
  const at = scoped.indexOf("@");
  return at > 0 ? scoped.slice(0, at) : null;
}

/**
 * Read a value scoped to the signed-in username (+ node).
 * Legacy unscoped JSON / bare-username keys migrate onto the current identity.
 * With no signed-in user the result is `fallback` (never another account's data).
 */
export function readUserScoped<T>(key: string, fallback: T, isLegacy?: (value: unknown) => value is T): T {
  if (!hasStorage()) return fallback;
  const user = currentStorageUser();
  if (!user) return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as unknown;
    if (isEnvelope<T>(parsed)) {
      if (user in parsed.byUser) return parsed.byUser[user]!;
      const bare = legacyBareUser(user);
      if (bare && bare in parsed.byUser) {
        const migratedValue = parsed.byUser[bare]!;
        const next: Envelope<T> = {
          byUser: { ...parsed.byUser, [user]: migratedValue },
        };
        delete next.byUser[bare];
        localStorage.setItem(key, JSON.stringify(next));
        return migratedValue;
      }
      return fallback;
    }
    const legacyOk = isLegacy ? isLegacy(parsed) : parsed !== undefined;
    if (!legacyOk) return fallback;
    const migrated: Envelope<T> = { byUser: { [user]: parsed as T } };
    localStorage.setItem(key, JSON.stringify(migrated));
    return parsed as T;
  } catch {
    return fallback;
  }
}

export function writeUserScoped<T>(key: string, value: T): void {
  if (!hasStorage()) return;
  const user = currentStorageUser();
  if (!user) return;
  let byUser: Record<string, T> = {};
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (isEnvelope<T>(parsed)) byUser = { ...parsed.byUser };
    }
  } catch {
    byUser = {};
  }
  const bare = legacyBareUser(user);
  if (bare && bare in byUser) delete byUser[bare];
  byUser[user] = value;
  localStorage.setItem(key, JSON.stringify({ byUser } satisfies Envelope<T>));
}

export function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}
