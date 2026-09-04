/** Dirty events so writers never import profileSync (keeps RSC graphs clean). */

export const PREFERENCES_DIRTY_EVENT = "wt-preferences-dirty";
export const FAVORITES_DIRTY_EVENT = "wt-favorites-dirty";

export function emitPreferencesDirty(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(PREFERENCES_DIRTY_EVENT));
}

export function emitFavoritesDirty(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(FAVORITES_DIRTY_EVENT));
}
