import type { MapPin } from "@/lib/mapPopup";

/** Filter map pins for search focus and audited-only mode. */
export function getVisiblePins(
  allPins: MapPin[],
  focusPins: MapPin[] | null | undefined,
  auditedOnly?: boolean
): MapPin[] {
  let pins = allPins;
  if (focusPins && focusPins.length > 0) {
    const focusIds = new Set(focusPins.map((p) => p.id));
    pins = allPins.filter((p) => focusIds.has(p.id));
  }
  if (auditedOnly) {
    pins = pins.filter((p) => p.audited);
  }
  return pins;
}
