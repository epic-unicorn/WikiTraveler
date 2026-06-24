export type SavedPlace = {
  id: string;
  name: string;
  location: string;
  nodeUrl: string;
  savedAt: string;
};

const KEY = "wt_saved_places";

export function readSavedPlaces(): SavedPlace[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedPlace[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeSavedPlaces(places: SavedPlace[]) {
  localStorage.setItem(KEY, JSON.stringify(places.slice(0, 100)));
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
  list.unshift({ ...place, savedAt: new Date().toISOString() });
  writeSavedPlaces(list);
  return true;
}

export function removeSavedPlace(id: string) {
  writeSavedPlaces(readSavedPlaces().filter((p) => p.id !== id));
}
