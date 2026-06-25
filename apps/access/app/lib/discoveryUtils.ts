import type { PropertySummary } from "@wikitraveler/ui";
import type { MapPin } from "./accessApi";

export type DiscoveryViewMode = "map" | "list";

const VIEW_MODE_KEY = "wt_discovery_view_mode";

export function getDiscoveryViewMode(): DiscoveryViewMode {
  if (typeof window === "undefined") return "map";
  const stored = sessionStorage.getItem(VIEW_MODE_KEY);
  if (stored === "map" || stored === "list") return stored;
  return "map";
}

export function setDiscoveryViewMode(mode: DiscoveryViewMode) {
  sessionStorage.setItem(VIEW_MODE_KEY, mode);
}

export function propertySummaryToMapPin(property: PropertySummary): MapPin {
  const audited =
    property.facts?.some((f) => f.tier === "VERIFIED" || f.tier === "CONFIRMED") ?? false;
  const facts: Record<string, { value: string; tier: string }> = {};
  for (const f of property.facts ?? []) {
    facts[f.fieldName] = { value: f.value, tier: f.tier };
  }
  return {
    id: property.id,
    name: property.name,
    location: property.location,
    lat: property.lat ?? 0,
    lon: property.lon ?? 0,
    audited,
    facts,
  };
}

export function pinsFromSummaries(properties: PropertySummary[]): MapPin[] {
  return properties
    .filter((p) => p.lat != null && p.lon != null && p.lat !== 0 && p.lon !== 0)
    .map(propertySummaryToMapPin);
}

export function hasMappablePins(pins: MapPin[]): boolean {
  return pins.some((p) => p.lat !== 0 && p.lon !== 0);
}
