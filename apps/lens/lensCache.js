/**
 * In-memory TTL cache with in-flight dedupe for Lens (popup / tests).
 * Mirrors Access clientCache behaviour at a smaller scale.
 */

const memory = new Map();
const inflight = new Map();

export const CACHE_TTL = {
  accessibility: 5 * 60 * 1000,
  search: 60 * 1000,
  health: 30 * 1000,
  card: 5 * 60 * 1000,
};

const MAX_ENTRIES = 100;

function touchKey(key) {
  const entry = memory.get(key);
  if (!entry) return;
  memory.delete(key);
  memory.set(key, entry);
}

function evictIfNeeded() {
  while (memory.size > MAX_ENTRIES) {
    const oldest = memory.keys().next().value;
    if (oldest == null) break;
    memory.delete(oldest);
  }
}

export function readCache(key) {
  const entry = memory.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    memory.delete(key);
    return null;
  }
  touchKey(key);
  return entry.value;
}

export function writeCache(key, value, ttlMs = CACHE_TTL.accessibility) {
  memory.set(key, { value, expiresAt: Date.now() + ttlMs });
  evictIfNeeded();
}

export function invalidateCache(prefix) {
  if (prefix == null || prefix === "") {
    memory.clear();
    inflight.clear();
    return;
  }
  for (const key of [...memory.keys()]) {
    if (key.startsWith(prefix)) memory.delete(key);
  }
  for (const key of [...inflight.keys()]) {
    if (key.startsWith(prefix)) inflight.delete(key);
  }
}

/** Deduplicate concurrent identical work and remember successful results. */
export async function cachedFetch(key, fn, ttlMs = CACHE_TTL.accessibility) {
  const cached = readCache(key);
  if (cached != null) return cached;

  const pending = inflight.get(key);
  if (pending) return pending;

  const promise = Promise.resolve()
    .then(fn)
    .then((value) => {
      writeCache(key, value, ttlMs);
      return value;
    })
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, promise);
  return promise;
}

export function accessibilityCacheKey(nodeUrl, propertyId) {
  return `a11y:${String(nodeUrl).replace(/\/$/, "")}:${propertyId}`;
}

export function searchCacheKey(nodeUrl, query) {
  return `search:${String(nodeUrl).replace(/\/$/, "")}:${String(query).trim().toLowerCase()}`;
}

export function healthCacheKey(nodeUrl) {
  return `health:${String(nodeUrl).replace(/\/$/, "")}`;
}
