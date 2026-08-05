import { parseBbox, validateBbox, type Bbox, type ValidateBboxResult } from "@/lib/bbox";
import { bboxAreaKm2 } from "@/lib/bbox";

/**
 * Ingest / Admin grouping by size and import path.
 * - city / country / region → tiled Overpass (unless offlineOnly)
 * - geofabrik → Geofabrik PBF import (requires osmium)
 */
export type RegionPresetTier = "city" | "country" | "region" | "geofabrik";

/**
 * World region for catalog UX. Every preset must set this so Admin can group
 * globally (not Europe-only). Aligns with GeofabrikContinent for PBF extracts.
 */
export type RegionContinent =
  | "europe"
  | "north-america"
  | "south-america"
  | "asia"
  | "africa"
  | "oceania";

export interface RegionPreset {
  id: string;
  label: string;
  bbox: string;
  tier: RegionPresetTier;
  /** World region — used for Admin optgroups and docs. */
  continent: RegionContinent;
  country?: string;
  /** When set, ingest uses Geofabrik PBF import instead of tiled Overpass. */
  geofabrikId?: string;
  /** Large multi-country presets — CLI/offline only, skip Overpass tile cap. */
  offlineOnly?: boolean;
}

export const REGION_CONTINENT_ORDER: RegionContinent[] = [
  "europe",
  "north-america",
  "south-america",
  "asia",
  "africa",
  "oceania",
];

export const REGION_CONTINENT_LABELS: Record<RegionContinent, string> = {
  europe: "Europe",
  "north-america": "North America",
  "south-america": "South America",
  asia: "Asia",
  africa: "Africa",
  oceania: "Oceania",
};

export const REGION_PRESET_TIER_LABELS: Record<RegionPresetTier, string> = {
  city: "Major cities",
  country: "Countries",
  region: "Multi-country regions",
  geofabrik: "Large regions (Geofabrik import)",
};

export const REGION_PRESET_TIER_ORDER: RegionPresetTier[] = [
  "city",
  "country",
  "region",
  "geofabrik",
];

/**
 * Curated global region catalog for Admin + CLI (`pnpm node:region --preset`).
 *
 * Organization:
 * - `tier` — ingest method / size class (city → Geofabrik)
 * - `continent` — world region for UI grouping (every continent has city + larger presets)
 *
 * To add a preset: pick tier + continent, set a tight bbox, and for large extracts
 * add a matching entry in `geofabrik.ts` then set `geofabrikId`. See docs/LOCAL.md
 * § “Region presets (global catalog)”.
 */
export const REGION_PRESETS: RegionPreset[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // Major cities (Overpass) — global federation starting points
  // ═══════════════════════════════════════════════════════════════════════════

  // Europe
  { id: "eindhoven", label: "Eindhoven", bbox: "51.39,5.42,51.49,5.52", tier: "city", continent: "europe", country: "NL" },
  { id: "amsterdam", label: "Amsterdam", bbox: "52.25,4.70,52.45,5.05", tier: "city", continent: "europe", country: "NL" },
  { id: "london", label: "London", bbox: "51.30,-0.48,51.67,0.30", tier: "city", continent: "europe", country: "GB" },
  { id: "paris", label: "Paris", bbox: "48.80,2.22,48.92,2.47", tier: "city", continent: "europe", country: "FR" },
  { id: "berlin", label: "Berlin", bbox: "52.33,13.09,52.68,13.76", tier: "city", continent: "europe", country: "DE" },
  { id: "barcelona", label: "Barcelona", bbox: "41.32,2.05,41.47,2.25", tier: "city", continent: "europe", country: "ES" },
  { id: "rome", label: "Rome", bbox: "41.79,12.35,42.00,12.62", tier: "city", continent: "europe", country: "IT" },
  { id: "vienna", label: "Vienna", bbox: "48.12,16.18,48.32,16.58", tier: "city", continent: "europe", country: "AT" },
  { id: "warsaw", label: "Warsaw", bbox: "52.10,20.85,52.37,21.28", tier: "city", continent: "europe", country: "PL" },
  { id: "prague", label: "Prague", bbox: "49.99,14.24,50.18,14.71", tier: "city", continent: "europe", country: "CZ" },

  // North America
  { id: "new-york-city", label: "New York City", bbox: "40.50,-74.28,40.92,-73.68", tier: "city", continent: "north-america", country: "US" },
  { id: "los-angeles", label: "Los Angeles", bbox: "33.70,-118.67,34.34,-117.90", tier: "city", continent: "north-america", country: "US" },
  { id: "chicago", label: "Chicago", bbox: "41.64,-87.94,42.02,-87.52", tier: "city", continent: "north-america", country: "US" },
  { id: "san-francisco", label: "San Francisco", bbox: "37.70,-122.52,37.84,-122.35", tier: "city", continent: "north-america", country: "US" },
  { id: "toronto", label: "Toronto", bbox: "43.58,-79.64,43.86,-79.12", tier: "city", continent: "north-america", country: "CA" },
  { id: "mexico-city", label: "Mexico City", bbox: "19.25,-99.35,19.60,-98.95", tier: "city", continent: "north-america", country: "MX" },
  { id: "boston", label: "Boston", bbox: "42.23,-71.19,42.40,-70.92", tier: "city", continent: "north-america", country: "US" },
  { id: "denver", label: "Denver", bbox: "39.61,-105.11,39.79,-104.86", tier: "city", continent: "north-america", country: "US" },

  // South America
  { id: "sao-paulo", label: "São Paulo", bbox: "-23.78,-46.83,-23.39,-46.36", tier: "city", continent: "south-america", country: "BR" },
  { id: "rio-de-janeiro", label: "Rio de Janeiro", bbox: "-23.08,-43.80,-22.74,-43.10", tier: "city", continent: "south-america", country: "BR" },
  { id: "buenos-aires", label: "Buenos Aires", bbox: "-34.71,-58.55,-34.52,-58.33", tier: "city", continent: "south-america", country: "AR" },
  { id: "bogota", label: "Bogotá", bbox: "4.46,-74.22,4.84,-73.99", tier: "city", continent: "south-america", country: "CO" },
  { id: "santiago", label: "Santiago", bbox: "-33.65,-70.85,-33.28,-70.50", tier: "city", continent: "south-america", country: "CL" },
  { id: "lima", label: "Lima", bbox: "-12.26,-77.17,-11.90,-76.85", tier: "city", continent: "south-america", country: "PE" },

  // Asia
  { id: "tokyo", label: "Tokyo", bbox: "35.53,139.55,35.82,139.92", tier: "city", continent: "asia", country: "JP" },
  { id: "seoul", label: "Seoul", bbox: "37.43,126.76,37.70,127.18", tier: "city", continent: "asia", country: "KR" },
  { id: "singapore", label: "Singapore", bbox: "1.20,103.60,1.47,104.05", tier: "city", continent: "asia", country: "SG" },
  { id: "bangkok", label: "Bangkok", bbox: "13.55,100.35,13.95,100.75", tier: "city", continent: "asia", country: "TH" },
  { id: "mumbai", label: "Mumbai", bbox: "18.89,72.77,19.27,72.98", tier: "city", continent: "asia", country: "IN" },
  { id: "delhi", label: "Delhi", bbox: "28.40,76.84,28.88,77.35", tier: "city", continent: "asia", country: "IN" },
  { id: "dubai", label: "Dubai", bbox: "24.95,55.05,25.35,55.45", tier: "city", continent: "asia", country: "AE" },
  { id: "hong-kong", label: "Hong Kong", bbox: "22.15,113.82,22.56,114.41", tier: "city", continent: "asia", country: "HK" },
  { id: "taipei", label: "Taipei", bbox: "24.96,121.45,25.16,121.67", tier: "city", continent: "asia", country: "TW" },
  { id: "jakarta", label: "Jakarta", bbox: "-6.40,106.68,-6.08,106.97", tier: "city", continent: "asia", country: "ID" },
  { id: "manila", label: "Manila", bbox: "14.50,120.95,14.75,121.12", tier: "city", continent: "asia", country: "PH" },

  // Africa
  { id: "cape-town", label: "Cape Town", bbox: "-34.20,18.30,-33.75,18.70", tier: "city", continent: "africa", country: "ZA" },
  { id: "johannesburg", label: "Johannesburg", bbox: "-26.35,27.85,-25.95,28.20", tier: "city", continent: "africa", country: "ZA" },
  { id: "nairobi", label: "Nairobi", bbox: "-1.40,36.70,-1.15,37.00", tier: "city", continent: "africa", country: "KE" },
  { id: "cairo", label: "Cairo", bbox: "29.95,31.10,30.20,31.50", tier: "city", continent: "africa", country: "EG" },
  { id: "lagos", label: "Lagos", bbox: "6.40,3.20,6.70,3.55", tier: "city", continent: "africa", country: "NG" },
  { id: "marrakech", label: "Marrakech", bbox: "31.55,-8.10,31.72,-7.90", tier: "city", continent: "africa", country: "MA" },

  // Oceania
  { id: "sydney", label: "Sydney", bbox: "-34.00,150.95,-33.75,151.30", tier: "city", continent: "oceania", country: "AU" },
  { id: "melbourne", label: "Melbourne", bbox: "-37.95,144.85,-37.70,145.15", tier: "city", continent: "oceania", country: "AU" },
  { id: "auckland", label: "Auckland", bbox: "-37.05,174.60,-36.75,174.95", tier: "city", continent: "oceania", country: "NZ" },
  { id: "brisbane", label: "Brisbane", bbox: "-27.55,152.90,-27.35,153.15", tier: "city", continent: "oceania", country: "AU" },

  // ═══════════════════════════════════════════════════════════════════════════
  // Countries — Overpass within tile budget (smaller extracts)
  // ═══════════════════════════════════════════════════════════════════════════

  // Europe
  { id: "belgium", label: "Belgium", bbox: "49.50,2.54,51.51,6.41", tier: "country", continent: "europe", country: "BE" },
  { id: "luxembourg", label: "Luxembourg", bbox: "49.44,5.73,50.18,6.53", tier: "country", continent: "europe", country: "LU" },
  { id: "ireland", label: "Ireland", bbox: "51.4,-10.5,55.4,-5.9", tier: "country", continent: "europe", country: "IE" },
  { id: "portugal", label: "Portugal", bbox: "36.9,-9.5,42.2,-6.2", tier: "country", continent: "europe", country: "PT" },
  { id: "switzerland", label: "Switzerland", bbox: "45.8,5.9,47.8,10.5", tier: "country", continent: "europe", country: "CH" },
  { id: "austria", label: "Austria", bbox: "46.4,9.5,49.0,17.2", tier: "country", continent: "europe", country: "AT" },
  { id: "czech-republic", label: "Czech Republic", bbox: "48.5,12.1,51.1,18.9", tier: "country", continent: "europe", country: "CZ" },
  { id: "denmark", label: "Denmark", bbox: "54.5,8.0,57.8,15.2", tier: "country", continent: "europe", country: "DK" },
  { id: "croatia", label: "Croatia", bbox: "42.4,13.5,46.5,19.4", tier: "country", continent: "europe", country: "HR" },
  { id: "hungary", label: "Hungary", bbox: "45.7,16.1,48.6,22.9", tier: "country", continent: "europe", country: "HU" },
  { id: "italy-north", label: "Northern Italy", bbox: "44.0,6.6,47.1,13.5", tier: "country", continent: "europe", country: "IT" },
  { id: "norway-south", label: "Norway (south)", bbox: "57.9,4.5,62.0,12.0", tier: "country", continent: "europe", country: "NO" },
  { id: "sweden-south", label: "Sweden (south)", bbox: "55.3,11.0,59.5,19.0", tier: "country", continent: "europe", country: "SE" },

  // Americas / Asia / Africa — smaller Overpass-friendly countries
  { id: "costa-rica", label: "Costa Rica", bbox: "8.0,-85.95,11.25,-82.55", tier: "country", continent: "north-america", country: "CR" },
  { id: "sri-lanka", label: "Sri Lanka", bbox: "5.9,79.5,9.9,81.9", tier: "country", continent: "asia", country: "LK" },
  { id: "jordan", label: "Jordan", bbox: "29.2,34.9,33.4,39.3", tier: "country", continent: "asia", country: "JO" },
  { id: "rwanda", label: "Rwanda", bbox: "-2.85,28.85,-1.05,30.9", tier: "country", continent: "africa", country: "RW" },

  // ═══════════════════════════════════════════════════════════════════════════
  // Multi-country regions (often offlineOnly — CLI)
  // ═══════════════════════════════════════════════════════════════════════════

  { id: "benelux", label: "Benelux", bbox: "49.40,2.50,53.55,7.23", tier: "region", continent: "europe", offlineOnly: true },
  { id: "alpine", label: "Alpine region", bbox: "45.8,5.9,48.0,16.0", tier: "region", continent: "europe" },
  {
    id: "west-europe",
    label: "West Europe",
    bbox: "36.0,-10.5,60.9,15.0",
    tier: "region",
    continent: "europe",
    offlineOnly: true,
  },
  {
    id: "andes-pacific",
    label: "Andes Pacific (CL+PE coast)",
    bbox: "-33.8,-77.5,-11.8,-70.0",
    tier: "region",
    continent: "south-america",
    offlineOnly: true,
  },
  {
    id: "east-africa-rift",
    label: "East Africa (KE+TZ)",
    bbox: "-11.8,29.3,5.0,41.9",
    tier: "region",
    continent: "africa",
    offlineOnly: true,
  },
  {
    id: "asean-mainland",
    label: "Mainland SE Asia (TH+VN)",
    bbox: "5.6,97.3,23.4,109.5",
    tier: "region",
    continent: "asia",
    offlineOnly: true,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // Large regions — Geofabrik PBF (requires osmium-tool)
  // geofabrikId must match an entry in geofabrik.ts
  // ═══════════════════════════════════════════════════════════════════════════

  // Europe
  {
    id: "netherlands",
    label: "Netherlands",
    bbox: "50.75,3.36,53.55,7.23",
    tier: "geofabrik",
    continent: "europe",
    country: "NL",
    geofabrikId: "netherlands",
  },
  {
    id: "france",
    label: "France",
    bbox: "41.33,-5.14,51.09,9.56",
    tier: "geofabrik",
    continent: "europe",
    country: "FR",
    geofabrikId: "france",
  },
  {
    id: "germany",
    label: "Germany",
    bbox: "47.27,5.87,55.06,15.04",
    tier: "geofabrik",
    continent: "europe",
    country: "DE",
    geofabrikId: "germany",
  },
  {
    id: "spain",
    label: "Spain",
    bbox: "36.0,-9.3,43.8,4.3",
    tier: "geofabrik",
    continent: "europe",
    country: "ES",
    geofabrikId: "spain",
  },
  {
    id: "italy",
    label: "Italy",
    bbox: "36.6,6.6,47.1,18.5",
    tier: "geofabrik",
    continent: "europe",
    country: "IT",
    geofabrikId: "italy",
  },
  {
    id: "great-britain",
    label: "Great Britain",
    bbox: "49.9,-8.65,60.86,1.77",
    tier: "geofabrik",
    continent: "europe",
    country: "GB",
    geofabrikId: "great-britain",
  },
  {
    id: "poland",
    label: "Poland",
    bbox: "49.0,14.1,54.8,24.2",
    tier: "geofabrik",
    continent: "europe",
    country: "PL",
    geofabrikId: "poland",
  },

  // North America (US states + Mexico; Canada is huge — offlineOnly via geofabrik)
  {
    id: "us-california",
    label: "California (US)",
    bbox: "32.5,-124.5,42.0,-114.1",
    tier: "geofabrik",
    continent: "north-america",
    country: "US",
    geofabrikId: "us-california",
  },
  {
    id: "us-new-york",
    label: "New York (US)",
    bbox: "40.5,-79.8,45.0,-71.9",
    tier: "geofabrik",
    continent: "north-america",
    country: "US",
    geofabrikId: "us-new-york",
  },
  {
    id: "us-florida",
    label: "Florida (US)",
    bbox: "24.4,-87.6,31.0,-80.0",
    tier: "geofabrik",
    continent: "north-america",
    country: "US",
    geofabrikId: "us-florida",
  },
  {
    id: "us-texas",
    label: "Texas (US)",
    bbox: "25.8,-106.7,36.5,-93.5",
    tier: "geofabrik",
    continent: "north-america",
    country: "US",
    geofabrikId: "us-texas",
  },
  {
    id: "us-illinois",
    label: "Illinois (US)",
    bbox: "36.97,-91.5,42.5,-87.5",
    tier: "geofabrik",
    continent: "north-america",
    country: "US",
    geofabrikId: "us-illinois",
  },
  {
    id: "us-washington",
    label: "Washington (US)",
    bbox: "45.5,-124.8,49.0,-116.9",
    tier: "geofabrik",
    continent: "north-america",
    country: "US",
    geofabrikId: "us-washington",
  },
  {
    id: "us-massachusetts",
    label: "Massachusetts (US)",
    bbox: "41.2,-73.5,42.9,-69.9",
    tier: "geofabrik",
    continent: "north-america",
    country: "US",
    geofabrikId: "us-massachusetts",
  },
  {
    id: "us-colorado",
    label: "Colorado (US)",
    bbox: "36.99,-109.1,41.0,-102.0",
    tier: "geofabrik",
    continent: "north-america",
    country: "US",
    geofabrikId: "us-colorado",
  },
  {
    id: "mexico",
    label: "Mexico",
    bbox: "14.5,-118.4,32.7,-86.7",
    tier: "geofabrik",
    continent: "north-america",
    country: "MX",
    geofabrikId: "mexico",
  },
  {
    id: "canada",
    label: "Canada",
    bbox: "41.7,-141.0,83.1,-52.6",
    tier: "geofabrik",
    continent: "north-america",
    country: "CA",
    geofabrikId: "canada",
    offlineOnly: true,
  },

  // South America
  {
    id: "brazil",
    label: "Brazil",
    bbox: "-33.8,-73.99,5.3,-34.8",
    tier: "geofabrik",
    continent: "south-america",
    country: "BR",
    geofabrikId: "brazil",
  },
  {
    id: "argentina",
    label: "Argentina",
    bbox: "-55.1,-73.6,-21.8,-53.6",
    tier: "geofabrik",
    continent: "south-america",
    country: "AR",
    geofabrikId: "argentina",
  },
  {
    id: "chile",
    label: "Chile",
    bbox: "-56.0,-75.7,-17.5,-66.4",
    tier: "geofabrik",
    continent: "south-america",
    country: "CL",
    geofabrikId: "chile",
  },
  {
    id: "colombia",
    label: "Colombia",
    bbox: "-4.3,-79.0,13.5,-66.9",
    tier: "geofabrik",
    continent: "south-america",
    country: "CO",
    geofabrikId: "colombia",
  },
  {
    id: "peru",
    label: "Peru",
    bbox: "-18.4,-81.4,0.0,-68.7",
    tier: "geofabrik",
    continent: "south-america",
    country: "PE",
    geofabrikId: "peru",
  },
  {
    id: "uruguay",
    label: "Uruguay",
    bbox: "-35.0,-58.5,-30.0,-53.1",
    tier: "geofabrik",
    continent: "south-america",
    country: "UY",
    geofabrikId: "uruguay",
  },

  // Asia
  {
    id: "japan",
    label: "Japan",
    bbox: "24.0,122.9,45.6,145.8",
    tier: "geofabrik",
    continent: "asia",
    country: "JP",
    geofabrikId: "japan",
  },
  {
    id: "south-korea",
    label: "South Korea",
    bbox: "33.1,124.6,38.6,131.9",
    tier: "geofabrik",
    continent: "asia",
    country: "KR",
    geofabrikId: "south-korea",
  },
  {
    id: "india",
    label: "India",
    bbox: "6.7,68.1,35.5,97.4",
    tier: "geofabrik",
    continent: "asia",
    country: "IN",
    geofabrikId: "india",
  },
  {
    id: "indonesia",
    label: "Indonesia",
    bbox: "-11.1,95.0,6.1,141.0",
    tier: "geofabrik",
    continent: "asia",
    country: "ID",
    geofabrikId: "indonesia",
  },
  {
    id: "thailand",
    label: "Thailand",
    bbox: "5.6,97.3,20.5,105.6",
    tier: "geofabrik",
    continent: "asia",
    country: "TH",
    geofabrikId: "thailand",
  },
  {
    id: "taiwan",
    label: "Taiwan",
    bbox: "21.9,119.3,25.3,122.0",
    tier: "geofabrik",
    continent: "asia",
    country: "TW",
    geofabrikId: "taiwan",
  },
  {
    id: "philippines",
    label: "Philippines",
    bbox: "4.6,116.9,21.1,126.6",
    tier: "geofabrik",
    continent: "asia",
    country: "PH",
    geofabrikId: "philippines",
  },
  {
    id: "vietnam",
    label: "Vietnam",
    bbox: "8.4,102.1,23.4,109.5",
    tier: "geofabrik",
    continent: "asia",
    country: "VN",
    geofabrikId: "vietnam",
  },
  {
    id: "gcc-states",
    label: "GCC States (Gulf)",
    bbox: "16.0,34.5,32.0,59.8",
    tier: "geofabrik",
    continent: "asia",
    geofabrikId: "gcc-states",
  },

  // Africa
  {
    id: "south-africa",
    label: "South Africa",
    bbox: "-34.9,16.3,-22.1,33.0",
    tier: "geofabrik",
    continent: "africa",
    country: "ZA",
    geofabrikId: "south-africa",
  },
  {
    id: "kenya",
    label: "Kenya",
    bbox: "-4.7,33.9,5.0,41.9",
    tier: "geofabrik",
    continent: "africa",
    country: "KE",
    geofabrikId: "kenya",
  },
  {
    id: "morocco",
    label: "Morocco",
    bbox: "21.3,-17.3,35.9,-1.0",
    tier: "geofabrik",
    continent: "africa",
    country: "MA",
    geofabrikId: "morocco",
  },
  {
    id: "egypt",
    label: "Egypt",
    bbox: "22.0,24.7,31.7,36.9",
    tier: "geofabrik",
    continent: "africa",
    country: "EG",
    geofabrikId: "egypt",
  },
  {
    id: "nigeria",
    label: "Nigeria",
    bbox: "4.3,2.7,13.9,14.7",
    tier: "geofabrik",
    continent: "africa",
    country: "NG",
    geofabrikId: "nigeria",
  },
  {
    id: "tanzania",
    label: "Tanzania",
    bbox: "-11.8,29.3,-0.99,40.4",
    tier: "geofabrik",
    continent: "africa",
    country: "TZ",
    geofabrikId: "tanzania",
  },
  {
    id: "tunisia",
    label: "Tunisia",
    bbox: "30.2,7.5,37.5,11.6",
    tier: "geofabrik",
    continent: "africa",
    country: "TN",
    geofabrikId: "tunisia",
  },

  // Oceania
  {
    id: "australia",
    label: "Australia",
    bbox: "-43.7,112.9,-10.0,153.7",
    tier: "geofabrik",
    continent: "oceania",
    country: "AU",
    geofabrikId: "australia",
  },
  {
    id: "new-zealand",
    label: "New Zealand",
    bbox: "-47.3,166.3,-34.4,178.6",
    tier: "geofabrik",
    continent: "oceania",
    country: "NZ",
    geofabrikId: "new-zealand",
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

export function listRegionPresetsByContinent(continent: RegionContinent): RegionPreset[] {
  return listRegionPresets().filter((p) => p.continent === continent);
}

/** Optgroup key for Admin select: tier × continent (HTML allows only one optgroup level). */
export function presetOptgroupKey(tier: RegionPresetTier, continent: RegionContinent): string {
  return `${tier}:${continent}`;
}
