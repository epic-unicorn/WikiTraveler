import { parseBbox, validateBbox, formatBbox, type Bbox, type ValidateBboxResult } from "@/lib/bbox";
import { bboxAreaKm2 } from "@/lib/bbox";

export type RegionPresetTier = "city" | "country" | "region" | "geofabrik";

export interface RegionPreset {
  id: string;
  label: string;
  bbox: string;
  tier: RegionPresetTier;
  country?: string;
  /** When set, ingest uses Geofabrik PBF import instead of tiled Overpass. */
  geofabrikId?: string;
  /** Large multi-country presets — CLI/offline only, skip Overpass tile cap. */
  offlineOnly?: boolean;
}

export const REGION_PRESET_TIER_LABELS: Record<RegionPresetTier, string> = {
  city: "Major cities",
  country: "Countries",
  region: "Multi-country regions",
  geofabrik: "Large countries (Geofabrik import)",
};

export const REGION_PRESETS: RegionPreset[] = [
  // — Major cities —
  { id: "eindhoven", label: "Eindhoven", bbox: "51.39,5.42,51.49,5.52", tier: "city", country: "NL" },
  { id: "amsterdam", label: "Amsterdam", bbox: "52.25,4.70,52.45,5.05", tier: "city", country: "NL" },
  { id: "london", label: "London", bbox: "51.30,-0.48,51.67,0.30", tier: "city", country: "GB" },
  { id: "paris", label: "Paris", bbox: "48.80,2.22,48.92,2.47", tier: "city", country: "FR" },
  { id: "berlin", label: "Berlin", bbox: "52.33,13.09,52.68,13.76", tier: "city", country: "DE" },

  // — Countries (offline Geofabrik / CLI) —
  {
    id: "netherlands",
    label: "Netherlands",
    bbox: "50.75,3.36,53.55,7.23",
    tier: "geofabrik",
    country: "NL",
    geofabrikId: "netherlands",
  },
  { id: "belgium", label: "Belgium", bbox: "49.50,2.54,51.51,6.41", tier: "country", country: "BE" },
  { id: "luxembourg", label: "Luxembourg", bbox: "49.44,5.73,50.18,6.53", tier: "country", country: "LU" },
  { id: "ireland", label: "Ireland", bbox: "51.4,-10.5,55.4,-5.9", tier: "country", country: "IE" },
  { id: "portugal", label: "Portugal", bbox: "36.9,-9.5,42.2,-6.2", tier: "country", country: "PT" },
  { id: "switzerland", label: "Switzerland", bbox: "45.8,5.9,47.8,10.5", tier: "country", country: "CH" },
  { id: "austria", label: "Austria", bbox: "46.4,9.5,49.0,17.2", tier: "country", country: "AT" },
  { id: "czech-republic", label: "Czech Republic", bbox: "48.5,12.1,51.1,18.9", tier: "country", country: "CZ" },
  { id: "denmark", label: "Denmark", bbox: "54.5,8.0,57.8,15.2", tier: "country", country: "DK" },
  { id: "croatia", label: "Croatia", bbox: "42.4,13.5,46.5,19.4", tier: "country", country: "HR" },
  { id: "hungary", label: "Hungary", bbox: "45.7,16.1,48.6,22.9", tier: "country", country: "HU" },
  { id: "italy-north", label: "Northern Italy", bbox: "44.0,6.6,47.1,13.5", tier: "country", country: "IT" },
  { id: "norway-south", label: "Norway (south)", bbox: "57.9,4.5,62.0,12.0", tier: "country", country: "NO" },
  { id: "sweden-south", label: "Sweden (south)", bbox: "55.3,11.0,59.5,19.0", tier: "country", country: "SE" },

  // — Multi-country (offline CLI) —
  { id: "benelux", label: "Benelux", bbox: "49.40,2.50,53.55,7.23", tier: "region", offlineOnly: true },
  { id: "alpine", label: "Alpine region", bbox: "45.8,5.9,48.0,16.0", tier: "region" },
  {
    id: "west-europe",
    label: "West Europe",
    bbox: "36.0,-10.5,60.9,15.0",
    tier: "region",
    offlineOnly: true,
  },

  // — Large countries (Geofabrik PBF — requires osmium-tool on server) —
  {
    id: "france",
    label: "France",
    bbox: "41.33,-5.14,51.09,9.56",
    tier: "geofabrik",
    country: "FR",
    geofabrikId: "france",
  },
  {
    id: "germany",
    label: "Germany",
    bbox: "47.27,5.87,55.06,15.04",
    tier: "geofabrik",
    country: "DE",
    geofabrikId: "germany",
  },
  {
    id: "spain",
    label: "Spain",
    bbox: "36.0,-9.3,43.8,4.3",
    tier: "geofabrik",
    country: "ES",
    geofabrikId: "spain",
  },
  {
    id: "italy",
    label: "Italy",
    bbox: "36.6,6.6,47.1,18.5",
    tier: "geofabrik",
    country: "IT",
    geofabrikId: "italy",
  },
  {
    id: "great-britain",
    label: "Great Britain",
    bbox: "49.9,-8.65,60.86,1.77",
    tier: "geofabrik",
    country: "GB",
    geofabrikId: "great-britain",
  },
  {
    id: "poland",
    label: "Poland",
    bbox: "49.0,14.1,54.8,24.2",
    tier: "geofabrik",
    country: "PL",
    geofabrikId: "poland",
  },
];

export function getPresetById(id: string): RegionPreset | undefined {
  return REGION_PRESETS.find((p) => p.id === id);
}

/** True when two bboxes match within ~1 km (handles 49.4 vs 49.40 formatting). */
export function bboxesEqual(a: Bbox, b: Bbox, epsilon = 0.01): boolean {
  return a.every((v, i) => Math.abs(v - b[i]) < epsilon);
}

/** Find a catalog preset whose bbox matches the given string. */
export function findPresetByBbox(raw: string | null | undefined): RegionPreset | undefined {
  const bbox = parseBbox(raw);
  if (!bbox) return undefined;
  return REGION_PRESETS.find((p) => {
    const presetBbox = parseBbox(p.bbox);
    return presetBbox != null && bboxesEqual(bbox, presetBbox);
  });
}

/** Prefer stored preset id, else infer from bbox. */
export function resolveEffectivePresetId(
  presetId: string | null | undefined,
  bbox: string | null | undefined
): string | null {
  if (presetId && getPresetById(presetId)) return presetId;
  return findPresetByBbox(bbox)?.id ?? null;
}

/** Human-readable region name — preset label when known, else stored/geocoded name. */
export function resolveRegionDisplayLabel(
  region: string | null | undefined,
  presetId: string | null | undefined,
  bbox: string | null | undefined
): string {
  const effectiveId = resolveEffectivePresetId(presetId, bbox);
  if (effectiveId) {
    const preset = getPresetById(effectiveId);
    if (preset) return preset.label;
  }
  return region?.trim() || "Unconfigured";
}

export function isGeofabrikPreset(preset: RegionPreset | undefined): boolean {
  return Boolean(preset?.geofabrikId);
}

export type RegionValidationResult = ValidateBboxResult & {
  ingestMode?: "overpass" | "geofabrik";
  geofabrikId?: string;
};

/** Validate bbox for admin apply — Geofabrik presets skip the Overpass tile cap. */
export function validateRegionBbox(raw: string, presetId?: string | null): RegionValidationResult {
  const preset = presetId ? getPresetById(presetId) : undefined;
  if (preset?.geofabrikId || preset?.offlineOnly) {
    const bbox = parseBbox(raw);
    if (!bbox) return { ok: false, message: "Invalid bbox format. Use minLat,minLon,maxLat,maxLon." };
    return {
      ok: true,
      bbox,
      tileCount: 0,
      warnLarge: true,
      areaKm2: bboxAreaKm2(bbox),
      ingestMode: preset.geofabrikId ? "geofabrik" : "overpass",
      geofabrikId: preset.geofabrikId,
    };
  }
  const result = validateBbox(raw);
  if (!result.ok) return result;
  return { ...result, ingestMode: "overpass" };
}

/** Presets available in Admin (Overpass within tile cap, or Geofabrik). */
export function listRegionPresets(): RegionPreset[] {
  return REGION_PRESETS.filter((p) => {
    if (p.geofabrikId || p.offlineOnly) return true;
    return validateBbox(p.bbox).ok;
  });
}

export function listRegionPresetsByTier(tier: RegionPresetTier): RegionPreset[] {
  return listRegionPresets().filter((p) => p.tier === tier);
}
