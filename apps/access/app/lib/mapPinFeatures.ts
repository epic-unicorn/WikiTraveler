import { normalizeBooleanValue } from "@wikitraveler/core";
import type { MapPin } from "./accessApi";

function pinHasYesFeature(pin: MapPin, fieldName: string): boolean {
  const raw = pin.facts?.[fieldName]?.value;
  if (!raw) return false;
  return normalizeBooleanValue(raw) === "yes";
}

/** Keep pins that have yes/true for every requested boolean feature (same as search API). */
export function filterPinsByFeatures(pins: MapPin[], features: readonly string[]): MapPin[] {
  if (features.length === 0) return pins;
  return pins.filter((pin) => features.every((field) => pinHasYesFeature(pin, field)));
}
