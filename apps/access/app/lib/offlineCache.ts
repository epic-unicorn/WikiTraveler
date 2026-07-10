const PREFIX = "wt_offline_property_";
const MAX_ENTRIES = 20;

export type CachedProperty = {
  propertyId: string;
  locale: string;
  fetchedAt: string;
  payload: unknown;
};

function key(propertyId: string, locale: string) {
  return `${PREFIX}${propertyId}::${locale}`;
}

export function cachePropertyDetail(entry: CachedProperty) {
  try {
    localStorage.setItem(key(entry.propertyId, entry.locale), JSON.stringify(entry));
    pruneOldEntries();
  } catch {
    // storage full — ignore
  }
}

export function readCachedPropertyDetail(propertyId: string, locale: string): CachedProperty | null {
  try {
    const raw = localStorage.getItem(key(propertyId, locale));
    if (!raw) return null;
    return JSON.parse(raw) as CachedProperty;
  } catch {
    return null;
  }
}

/** Keys to remove when cache exceeds maxEntries (oldest first). Exported for tests. */
export function selectOldestCacheKeys(
  entries: Array<{ key: string; fetchedAt: string }>,
  maxEntries: number
): string[] {
  if (entries.length <= maxEntries) return [];
  return entries
    .sort((a, b) => a.fetchedAt.localeCompare(b.fetchedAt))
    .slice(0, entries.length - maxEntries)
    .map((e) => e.key);
}

function pruneOldEntries() {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k?.startsWith(PREFIX)) keys.push(k);
  }
  if (keys.length <= MAX_ENTRIES) return;
  const entries = keys
    .map((k) => {
      try {
        const v = JSON.parse(localStorage.getItem(k) ?? "") as CachedProperty;
        return { key: k, fetchedAt: v.fetchedAt ?? "" };
      } catch {
        return { key: k, fetchedAt: "" };
      }
    });
  selectOldestCacheKeys(entries, MAX_ENTRIES).forEach((k) => localStorage.removeItem(k));
}
