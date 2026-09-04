import { inferSavedCategory, type SavedPlaceCategory } from "./savedCategory";
import { emitFavoritesDirty } from "./profileSyncEvents";
import { readUserScoped, writeUserScoped } from "./userScopedStorage";

export type { SavedPlaceCategory };

export type SavedPlaceFact = { fieldName: string; value: string };

export type SavedPlace = {
  id: string;
  name: string;
  location: string;
  nodeUrl: string;
  savedAt: string;
  /** Hero / first audit photo URL; `null` means checked with no photo. */
  imageUrl?: string | null;
  category?: SavedPlaceCategory;
  facts?: SavedPlaceFact[];
};

const KEY = "wt_saved_places";
export const SAVED_PLACES_EVENT = "wt-saved-places-changed";

function emitSavedChange() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(SAVED_PLACES_EVENT));
}

function normalizePlace(place: SavedPlace): SavedPlace {
  return {
    ...place,
    category: place.category ?? inferSavedCategory(place.name, place.location),
  };
}

function isSavedPlaceList(value: unknown): value is SavedPlace[] {
  return Array.isArray(value);
}

export function readSavedPlaces(): SavedPlace[] {
  if (typeof localStorage === "undefined") return [];
  return readUserScoped<SavedPlace[]>(KEY, [], isSavedPlaceList).map(normalizePlace);
}

export function writeSavedPlaces(places: SavedPlace[], opts?: { skipSync?: boolean }) {
  writeUserScoped(KEY, places.slice(0, 100));
  emitSavedChange();
  if (!opts?.skipSync) {
    emitFavoritesDirty();
  }
}

export function readSavedPlaceIds(): Set<string> {
  return new Set(readSavedPlaces().map((p) => p.id));
}

export function isPlaceSaved(id: string): boolean {
  return readSavedPlaces().some((p) => p.id === id);
}

export function toggleSavedPlace(place: Omit<SavedPlace, "savedAt">): boolean {
  const list = readSavedPlaces();
  const idx = list.findIndex((p) => p.id === place.id);
  if (idx >= 0) {
    list.splice(idx, 1);
    writeSavedPlaces(list);
    return false;
  }
  list.unshift({
    ...place,
    category: place.category ?? inferSavedCategory(place.name, place.location),
    savedAt: new Date().toISOString(),
  });
  writeSavedPlaces(list);
  return true;
}

export function removeSavedPlace(id: string) {
  writeSavedPlaces(readSavedPlaces().filter((p) => p.id !== id));
}

/** Merge fields onto an existing saved place (e.g. hydrate imageUrl). */
export function patchSavedPlace(id: string, patch: Partial<Omit<SavedPlace, "id" | "savedAt">>) {
  const list = readSavedPlaces();
  const idx = list.findIndex((p) => p.id === id);
  if (idx < 0) return;
  list[idx] = { ...list[idx], ...patch };
  // Hydration is cache-only; do not write-through (avoids stamp races / PUT spam).
  writeSavedPlaces(list, { skipSync: true });
}
