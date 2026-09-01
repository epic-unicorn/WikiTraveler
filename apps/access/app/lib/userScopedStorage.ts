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

function currentUser(): string | null {
  if (!hasStorage()) return null;
  const raw = localStorage.getItem("wt_username");
  const user = raw?.trim().toLowerCase();
  return user || null;
}

function hasStorage(): boolean {
  try {
    return typeof localStorage !== "undefined";
  } catch {
    return false;
  }
}

/**
 * Read a value scoped to the signed-in username.
 * Legacy unscoped JSON is migrated onto the current user as an envelope.
 * With no signed-in user the result is `fallback` (never another account's data).
 */
export function readUserScoped<T>(key: string, fallback: T, isLegacy?: (value: unknown) => value is T): T {
  if (!hasStorage()) return fallback;
  const user = currentUser();
  if (!user) return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as unknown;
    if (isEnvelope<T>(parsed)) {
      return user in parsed.byUser ? parsed.byUser[user]! : fallback;
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
  const user = currentUser();
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
  byUser[user] = value;
  localStorage.setItem(key, JSON.stringify({ byUser } satisfies Envelope<T>));
}

export function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}
