import { applyTheme, type ThemeMode } from "@wikitraveler/ui";
import {
  A11Y_PREFERENCE_OPTIONS,
  readA11yPreferences,
  writeA11yPreferences,
  type A11yPreferenceKey,
} from "./a11yPreferences";
import { getAuthHeaders, getStoredNodeUrl } from "./accessApi";
import { AUTH_CHANGED_EVENT, readAuthToken } from "./authStorage";
import {
  readSavedPlaces,
  writeSavedPlaces,
  type SavedPlace,
} from "./savedPlaces";
import {
  DEFAULT_ACCESS_THEME,
  readAccessThemePreference,
  writeAccessThemePreference,
} from "./themePreference";
import { readUserScoped, writeUserScoped } from "./userScopedStorage";

const PREFS_STAMP_KEY = "wt_prefs_updated_at";
const FAVS_STAMP_KEY = "wt_favorites_updated_at";
const SYNCED_EVENT = "wt-profile-synced";

type ServerPreferences = {
  a11yPreferences: string[];
  theme: ThemeMode | null;
  updatedAt: string;
};

type ServerFavorites = {
  places: SavedPlace[];
  updatedAt: string;
};

let syncInFlight: Promise<void> | null = null;
let pushPrefsTimer: ReturnType<typeof setTimeout> | null = null;
let pushFavsTimer: ReturnType<typeof setTimeout> | null = null;

function isThemeMode(value: unknown): value is ThemeMode {
  return value === "light" || value === "dark" || value === "contrast" || value === "calm";
}

function stampMs(iso: string | null | undefined): number {
  if (!iso) return 0;
  const n = Date.parse(iso);
  return Number.isFinite(n) ? n : 0;
}

function readCacheStamp(key: string): string | null {
  const v = readUserScoped<string | null>(key, null, (x): x is string => typeof x === "string");
  return typeof v === "string" ? v : null;
}

function writeCacheStamp(key: string, iso: string) {
  writeUserScoped(key, iso);
}

function filterA11y(keys: string[]): A11yPreferenceKey[] {
  const allowed = new Set<string>(A11Y_PREFERENCE_OPTIONS);
  return keys.filter((k): k is A11yPreferenceKey => allowed.has(k));
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T | null> {
  const token = readAuthToken();
  if (!token) return null;
  const nodeUrl = getStoredNodeUrl();
  try {
    const res = await fetch(`${nodeUrl}${path}`, {
      ...init,
      headers: {
        ...getAuthHeaders(),
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...(init?.headers ?? {}),
      },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function applyPreferencesLocally(prefs: ServerPreferences) {
  writeA11yPreferences(filterA11y(prefs.a11yPreferences), { skipSync: true });
  if (prefs.theme && isThemeMode(prefs.theme)) {
    writeAccessThemePreference(prefs.theme, { skipSync: true });
    if (typeof document !== "undefined") {
      applyTheme(prefs.theme);
    }
  }
  writeCacheStamp(PREFS_STAMP_KEY, prefs.updatedAt);
}

function applyFavoritesLocally(data: ServerFavorites) {
  writeSavedPlaces(Array.isArray(data.places) ? data.places : [], { skipSync: true });
  writeCacheStamp(FAVS_STAMP_KEY, data.updatedAt);
}

async function pushPreferencesNow(): Promise<void> {
  const a11yPreferences = readA11yPreferences();
  const theme = readAccessThemePreference();
  const data = await fetchJson<{ preferences: ServerPreferences }>("/api/auth/preferences", {
    method: "PUT",
    body: JSON.stringify({ a11yPreferences, theme }),
  });
  if (data?.preferences?.updatedAt) {
    writeCacheStamp(PREFS_STAMP_KEY, data.preferences.updatedAt);
  }
}

async function pushFavoritesNow(): Promise<void> {
  const places = readSavedPlaces();
  const data = await fetchJson<ServerFavorites>("/api/auth/favorites", {
    method: "PUT",
    body: JSON.stringify({ places }),
  });
  if (data?.updatedAt) {
    writeCacheStamp(FAVS_STAMP_KEY, data.updatedAt);
  }
}

/** Debounced write-through after local preference edits. */
export function schedulePreferencesPush(): void {
  if (typeof globalThis.localStorage === "undefined" || !readAuthToken()) return;
  if (pushPrefsTimer) clearTimeout(pushPrefsTimer);
  pushPrefsTimer = setTimeout(() => {
    pushPrefsTimer = null;
    void pushPreferencesNow();
  }, 400);
}

/** Debounced write-through after local favorites edits. */
export function scheduleFavoritesPush(): void {
  if (typeof globalThis.localStorage === "undefined" || !readAuthToken()) return;
  if (pushFavsTimer) clearTimeout(pushFavsTimer);
  pushFavsTimer = setTimeout(() => {
    pushFavsTimer = null;
    void pushFavoritesNow();
  }, 400);
}

/**
 * Pull server profile into localStorage cache (LWW on updatedAt).
 * If server is empty and cache has data, push once (legacy migration).
 */
export async function syncProfileFromServer(): Promise<void> {
  if (typeof globalThis.localStorage === "undefined" || !readAuthToken()) return;
  if (syncInFlight) return syncInFlight;

  syncInFlight = (async () => {
    const me = await fetchJson<{
      preferences?: ServerPreferences;
    }>("/api/auth/me");
    const favs = await fetchJson<ServerFavorites>("/api/auth/favorites");

    if (me?.preferences) {
      const serverMs = stampMs(me.preferences.updatedAt);
      const cacheMs = stampMs(readCacheStamp(PREFS_STAMP_KEY));
      const serverEmpty =
        me.preferences.a11yPreferences.length === 0 &&
        (me.preferences.theme == null || me.preferences.theme === DEFAULT_ACCESS_THEME);
      const localA11y = readA11yPreferences();
      const localTheme = readAccessThemePreference();
      const localHas = localA11y.length > 0 || localTheme !== DEFAULT_ACCESS_THEME;

      if (cacheMs > serverMs && localHas) {
        await pushPreferencesNow();
      } else if (serverMs >= cacheMs && (!serverEmpty || cacheMs > 0)) {
        applyPreferencesLocally(me.preferences);
      } else if (serverEmpty && localHas && cacheMs === 0) {
        await pushPreferencesNow();
      }
    }

    if (favs) {
      const serverMs = stampMs(favs.updatedAt);
      const cacheMs = stampMs(readCacheStamp(FAVS_STAMP_KEY));
      const serverEmpty = !favs.places?.length;
      const localPlaces = readSavedPlaces();

      if (cacheMs > serverMs && localPlaces.length > 0) {
        await pushFavoritesNow();
      } else if (serverMs >= cacheMs && (!serverEmpty || cacheMs > 0)) {
        applyFavoritesLocally(favs);
      } else if (serverEmpty && localPlaces.length > 0 && cacheMs === 0) {
        await pushFavoritesNow();
      } else if (!serverEmpty && cacheMs === 0) {
        applyFavoritesLocally(favs);
      }
    }

    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event(SYNCED_EVENT));
    }
  })().finally(() => {
    syncInFlight = null;
  });

  return syncInFlight;
}

/** Wire login/logout/focus sync once for the Access shell. */
export function startProfileSync(): () => void {
  if (typeof window === "undefined") return () => {};

  const run = () => {
    void syncProfileFromServer();
  };
  run();

  const onAuth = () => run();
  const onFocus = () => {
    if (document.visibilityState === "visible") run();
  };

  window.addEventListener(AUTH_CHANGED_EVENT, onAuth);
  document.addEventListener("visibilitychange", onFocus);
  window.addEventListener("focus", onFocus);

  return () => {
    window.removeEventListener(AUTH_CHANGED_EVENT, onAuth);
    document.removeEventListener("visibilitychange", onFocus);
    window.removeEventListener("focus", onFocus);
  };
}

export { SYNCED_EVENT };
