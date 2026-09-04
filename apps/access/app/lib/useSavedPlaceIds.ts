"use client";

import { useEffect, useState } from "react";
import { AUTH_CHANGED_EVENT } from "./authStorage";
import { readSavedPlaceIds, SAVED_PLACES_EVENT } from "./savedPlaces";

/** Reactive set of saved property IDs that updates on save/remove (same tab + cross tab). */
export function useSavedPlaceIds(): Set<string> {
  const [ids, setIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    const sync = () => setIds(readSavedPlaceIds());
    sync();
    window.addEventListener(SAVED_PLACES_EVENT, sync);
    window.addEventListener(AUTH_CHANGED_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(SAVED_PLACES_EVENT, sync);
      window.removeEventListener(AUTH_CHANGED_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return ids;
}
