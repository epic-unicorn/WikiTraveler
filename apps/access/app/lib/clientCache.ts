/** LRU-ish client memory cache with TTL and in-flight dedupe. */

type CacheEntry<T> = { value: T; expiresAt: number };

const memory = new Map<string, CacheEntry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

const DEFAULT_TTL_MS = 5 * 60 * 1000;
const MAX_ENTRIES = 80;

function touchKey(key: string): void {
  const entry = memory.get(key);
  if (!entry) return;
  memory.delete(key);
  memory.set(key, entry);
}

function evictIfNeeded(): void {
  while (memory.size > MAX_ENTRIES) {
    const oldest = memory.keys().next().value;
    if (oldest == null) break;
    memory.delete(oldest);
  }
}

export function readClientCache<T>(key: string): T | null {
  const entry = memory.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    memory.delete(key);
    return null;
  }
  touchKey(key);
  return entry.value as T;
}

export function writeClientCache<T>(key: string, value: T, ttlMs = DEFAULT_TTL_MS): void {
  memory.set(key, { value, expiresAt: Date.now() + ttlMs });
  evictIfNeeded();
}

/** Drop cached entries (all, or those whose key starts with `prefix`). */
export function invalidateClientCache(prefix?: string): void {
  if (!prefix) {
    memory.clear();
    return;
  }
  for (const key of memory.keys()) {
    if (key.startsWith(prefix)) memory.delete(key);
  }
}

/** Deduplicate concurrent identical requests (e.g. React Strict Mode double-mount in dev). */
export async function dedupedFetch<T>(key: string, fn: () => Promise<T>, ttlMs = DEFAULT_TTL_MS): Promise<T> {
  const cached = readClientCache<T>(key);
  if (cached != null) return cached;

  const pending = inflight.get(key);
  if (pending) return pending as Promise<T>;

  const promise = fn()
    .then((value) => {
      writeClientCache(key, value, ttlMs);
      return value;
    })
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, promise);
  return promise;
}
