import type { Bbox } from "@/lib/bbox";
import { containsPoint } from "@/lib/bbox";

/**
 * Geofabrik download continent path segment.
 * Matches https://download.geofabrik.de/ top-level folders (australia-oceania → oceania in our UI).
 */
export type GeofabrikContinent =
  | "europe"
  | "north-america"
  | "south-america"
  | "asia"
  | "africa"
  | "oceania";

/** Geofabrik extract regions — large countries / states impractical for tiled Overpass. */
export interface GeofabrikRegion {
  id: string;
  label: string;
  /** World region for catalog grouping (not the URL path alone). */
  continent: GeofabrikContinent;
  bbox: Bbox;
  /** Approximate .osm.pbf download size for admin preview. */
  downloadSizeMb: number;
  /** Rough ingest duration on a typical VPS. */
  estimatedMinutes: number;
  /** Full download URL under download.geofabrik.de. */
  url: string;
}

const BASE = "https://download.geofabrik.de";

/** Build a standard Geofabrik latest.osm.pbf URL from a relative path (no suffix). */
function pbfUrl(path: string): string {
  return `${BASE}/${path}-latest.osm.pbf`;
}

export const GEOFABRIK_REGIONS: GeofabrikRegion[] = [
  // ── Europe ──────────────────────────────────────────────────────────────
  {
    id: "netherlands",
    label: "Netherlands",
    continent: "europe",
    bbox: [50.75, 3.36, 53.55, 7.23],
    downloadSizeMb: 1300,
    estimatedMinutes: 25,
    url: pbfUrl("europe/netherlands"),
  },
  {
    id: "belgium",
    label: "Belgium",
    continent: "europe",
    bbox: [49.5, 2.54, 51.51, 6.41],
    downloadSizeMb: 520,
    estimatedMinutes: 20,
    url: pbfUrl("europe/belgium"),
  },
  {
    id: "luxembourg",
    label: "Luxembourg",
    continent: "europe",
    bbox: [49.44, 5.73, 50.18, 6.53],
    downloadSizeMb: 40,
    estimatedMinutes: 5,
    url: pbfUrl("europe/luxembourg"),
  },
  {
    id: "ireland",
    label: "Ireland",
    continent: "europe",
    bbox: [51.4, -10.5, 55.4, -5.9],
    downloadSizeMb: 240,
    estimatedMinutes: 15,
    // Geofabrik uses a combined Ireland + Northern Ireland extract name.
    url: pbfUrl("europe/ireland-and-northern-ireland"),
  },
  {
    id: "portugal",
    label: "Portugal",
    continent: "europe",
    bbox: [36.9, -9.5, 42.2, -6.2],
    downloadSizeMb: 320,
    estimatedMinutes: 18,
    url: pbfUrl("europe/portugal"),
  },
  {
    id: "switzerland",
    label: "Switzerland",
    continent: "europe",
    bbox: [45.8, 5.9, 47.8, 10.5],
    downloadSizeMb: 430,
    estimatedMinutes: 20,
    url: pbfUrl("europe/switzerland"),
  },
  {
    id: "austria",
    label: "Austria",
    continent: "europe",
    bbox: [46.4, 9.5, 49.0, 17.2],
    downloadSizeMb: 720,
    estimatedMinutes: 25,
    url: pbfUrl("europe/austria"),
  },
  {
    id: "france",
    label: "France",
    continent: "europe",
    bbox: [41.33, -5.14, 51.09, 9.56],
    downloadSizeMb: 890,
    estimatedMinutes: 45,
    url: pbfUrl("europe/france"),
  },
  {
    id: "germany",
    label: "Germany",
    continent: "europe",
    bbox: [47.27, 5.87, 55.06, 15.04],
    downloadSizeMb: 790,
    estimatedMinutes: 40,
    url: pbfUrl("europe/germany"),
  },
  {
    id: "spain",
    label: "Spain",
    continent: "europe",
    bbox: [36.0, -9.3, 43.8, 4.3],
    downloadSizeMb: 650,
    estimatedMinutes: 35,
    url: pbfUrl("europe/spain"),
  },
  {
    id: "italy",
    label: "Italy",
    continent: "europe",
    bbox: [36.6, 6.6, 47.1, 18.5],
    downloadSizeMb: 720,
    estimatedMinutes: 40,
    url: pbfUrl("europe/italy"),
  },
  {
    id: "great-britain",
    label: "Great Britain",
    continent: "europe",
    bbox: [49.9, -8.65, 60.86, 1.77],
    downloadSizeMb: 820,
    estimatedMinutes: 45,
    url: pbfUrl("europe/great-britain"),
  },
  {
    id: "poland",
    label: "Poland",
    continent: "europe",
    bbox: [49.0, 14.1, 54.8, 24.2],
    downloadSizeMb: 520,
    estimatedMinutes: 30,
    url: pbfUrl("europe/poland"),
  },

  // ── North America ───────────────────────────────────────────────────────
  {
    id: "us-california",
    label: "California (US)",
    continent: "north-america",
    bbox: [32.5, -124.5, 42.0, -114.1],
    downloadSizeMb: 1200,
    estimatedMinutes: 50,
    url: pbfUrl("north-america/us/california"),
  },
  {
    id: "us-new-york",
    label: "New York (US)",
    continent: "north-america",
    bbox: [40.5, -79.8, 45.0, -71.9],
    downloadSizeMb: 471,
    estimatedMinutes: 30,
    url: pbfUrl("north-america/us/new-york"),
  },
  {
    id: "us-florida",
    label: "Florida (US)",
    continent: "north-america",
    bbox: [24.4, -87.6, 31.0, -80.0],
    downloadSizeMb: 623,
    estimatedMinutes: 35,
    url: pbfUrl("north-america/us/florida"),
  },
  {
    id: "us-texas",
    label: "Texas (US)",
    continent: "north-america",
    bbox: [25.8, -106.7, 36.5, -93.5],
    downloadSizeMb: 679,
    estimatedMinutes: 40,
    url: pbfUrl("north-america/us/texas"),
  },
  {
    id: "us-illinois",
    label: "Illinois (US)",
    continent: "north-america",
    bbox: [36.97, -91.5, 42.5, -87.5],
    downloadSizeMb: 339,
    estimatedMinutes: 25,
    url: pbfUrl("north-america/us/illinois"),
  },
  {
    id: "us-washington",
    label: "Washington (US)",
    continent: "north-america",
    bbox: [45.5, -124.8, 49.0, -116.9],
    downloadSizeMb: 343,
    estimatedMinutes: 25,
    url: pbfUrl("north-america/us/washington"),
  },
  {
    id: "us-massachusetts",
    label: "Massachusetts (US)",
    continent: "north-america",
    bbox: [41.2, -73.5, 42.9, -69.9],
    downloadSizeMb: 294,
    estimatedMinutes: 20,
    url: pbfUrl("north-america/us/massachusetts"),
  },
  {
    id: "us-colorado",
    label: "Colorado (US)",
    continent: "north-america",
    bbox: [36.99, -109.1, 41.0, -102.0],
    downloadSizeMb: 359,
    estimatedMinutes: 25,
    url: pbfUrl("north-america/us/colorado"),
  },
  {
    id: "mexico",
    label: "Mexico",
    continent: "north-america",
    bbox: [14.5, -118.4, 32.7, -86.7],
    downloadSizeMb: 613,
    estimatedMinutes: 35,
    url: pbfUrl("north-america/mexico"),
  },
  {
    id: "canada",
    label: "Canada",
    continent: "north-america",
    bbox: [41.7, -141.0, 83.1, -52.6],
    downloadSizeMb: 6000,
    estimatedMinutes: 180,
    url: pbfUrl("north-america/canada"),
  },

  // ── South America ───────────────────────────────────────────────────────
  {
    id: "brazil",
    label: "Brazil",
    continent: "south-america",
    bbox: [-33.8, -73.99, 5.3, -34.8],
    downloadSizeMb: 1900,
    estimatedMinutes: 90,
    url: pbfUrl("south-america/brazil"),
  },
  {
    id: "argentina",
    label: "Argentina",
    continent: "south-america",
    bbox: [-55.1, -73.6, -21.8, -53.6],
    downloadSizeMb: 406,
    estimatedMinutes: 30,
    url: pbfUrl("south-america/argentina"),
  },
  {
    id: "chile",
    label: "Chile",
    continent: "south-america",
    bbox: [-56.0, -75.7, -17.5, -66.4],
    downloadSizeMb: 329,
    estimatedMinutes: 25,
    url: pbfUrl("south-america/chile"),
  },
  {
    id: "colombia",
    label: "Colombia",
    continent: "south-america",
    bbox: [-4.3, -79.0, 13.5, -66.9],
    downloadSizeMb: 308,
    estimatedMinutes: 25,
    url: pbfUrl("south-america/colombia"),
  },
  {
    id: "peru",
    label: "Peru",
    continent: "south-america",
    bbox: [-18.4, -81.4, -0.0, -68.7],
    downloadSizeMb: 242,
    estimatedMinutes: 20,
    url: pbfUrl("south-america/peru"),
  },
  {
    id: "uruguay",
    label: "Uruguay",
    continent: "south-america",
    bbox: [-35.0, -58.5, -30.0, -53.1],
    downloadSizeMb: 70,
    estimatedMinutes: 10,
    url: pbfUrl("south-america/uruguay"),
  },

  // ── Asia ────────────────────────────────────────────────────────────────
  {
    id: "japan",
    label: "Japan",
    continent: "asia",
    bbox: [24.0, 122.9, 45.6, 145.8],
    downloadSizeMb: 2300,
    estimatedMinutes: 100,
    url: pbfUrl("asia/japan"),
  },
  {
    id: "south-korea",
    label: "South Korea",
    continent: "asia",
    bbox: [33.1, 124.6, 38.6, 131.9],
    downloadSizeMb: 271,
    estimatedMinutes: 20,
    url: pbfUrl("asia/south-korea"),
  },
  {
    id: "india",
    label: "India",
    continent: "asia",
    bbox: [6.7, 68.1, 35.5, 97.4],
    downloadSizeMb: 1600,
    estimatedMinutes: 80,
    url: pbfUrl("asia/india"),
  },
  {
    id: "indonesia",
    label: "Indonesia",
    continent: "asia",
    bbox: [-11.1, 95.0, 6.1, 141.0],
    downloadSizeMb: 1600,
    estimatedMinutes: 80,
    url: pbfUrl("asia/indonesia"),
  },
  {
    id: "thailand",
    label: "Thailand",
    continent: "asia",
    bbox: [5.6, 97.3, 20.5, 105.6],
    downloadSizeMb: 310,
    estimatedMinutes: 25,
    url: pbfUrl("asia/thailand"),
  },
  {
    id: "taiwan",
    label: "Taiwan",
    continent: "asia",
    bbox: [21.9, 119.3, 25.3, 122.0],
    downloadSizeMb: 310,
    estimatedMinutes: 20,
    url: pbfUrl("asia/taiwan"),
  },
  {
    id: "philippines",
    label: "Philippines",
    continent: "asia",
    bbox: [4.6, 116.9, 21.1, 126.6],
    downloadSizeMb: 575,
    estimatedMinutes: 35,
    url: pbfUrl("asia/philippines"),
  },
  {
    id: "vietnam",
    label: "Vietnam",
    continent: "asia",
    bbox: [8.4, 102.1, 23.4, 109.5],
    downloadSizeMb: 310,
    estimatedMinutes: 25,
    url: pbfUrl("asia/vietnam"),
  },
  {
    id: "gcc-states",
    label: "GCC States (Gulf)",
    continent: "asia",
    bbox: [16.0, 34.5, 32.0, 59.8],
    downloadSizeMb: 240,
    estimatedMinutes: 20,
    url: pbfUrl("asia/gcc-states"),
  },

  // ── Africa ──────────────────────────────────────────────────────────────
  {
    id: "south-africa",
    label: "South Africa",
    continent: "africa",
    bbox: [-34.9, 16.3, -22.1, 33.0],
    downloadSizeMb: 398,
    estimatedMinutes: 30,
    url: pbfUrl("africa/south-africa"),
  },
  {
    id: "kenya",
    label: "Kenya",
    continent: "africa",
    bbox: [-4.7, 33.9, 5.0, 41.9],
    downloadSizeMb: 332,
    estimatedMinutes: 25,
    url: pbfUrl("africa/kenya"),
  },
  {
    id: "morocco",
    label: "Morocco",
    continent: "africa",
    bbox: [21.3, -17.3, 35.9, -1.0],
    downloadSizeMb: 231,
    estimatedMinutes: 20,
    url: pbfUrl("africa/morocco"),
  },
  {
    id: "egypt",
    label: "Egypt",
    continent: "africa",
    bbox: [22.0, 24.7, 31.7, 36.9],
    downloadSizeMb: 169,
    estimatedMinutes: 18,
    url: pbfUrl("africa/egypt"),
  },
  {
    id: "nigeria",
    label: "Nigeria",
    continent: "africa",
    bbox: [4.3, 2.7, 13.9, 14.7],
    downloadSizeMb: 677,
    estimatedMinutes: 40,
    url: pbfUrl("africa/nigeria"),
  },
  {
    id: "tanzania",
    label: "Tanzania",
    continent: "africa",
    bbox: [-11.8, 29.3, -0.99, 40.4],
    downloadSizeMb: 672,
    estimatedMinutes: 40,
    url: pbfUrl("africa/tanzania"),
  },
  {
    id: "tunisia",
    label: "Tunisia",
    continent: "africa",
    bbox: [30.2, 7.5, 37.5, 11.6],
    downloadSizeMb: 90,
    estimatedMinutes: 12,
    url: pbfUrl("africa/tunisia"),
  },

  // ── Oceania ─────────────────────────────────────────────────────────────
  {
    id: "australia",
    label: "Australia",
    continent: "oceania",
    bbox: [-43.7, 112.9, -10.0, 153.7],
    downloadSizeMb: 912,
    estimatedMinutes: 50,
    url: pbfUrl("australia-oceania/australia"),
  },
  {
    id: "new-zealand",
    label: "New Zealand",
    continent: "oceania",
    bbox: [-47.3, 166.3, -34.4, 178.6],
    downloadSizeMb: 382,
    estimatedMinutes: 25,
    url: pbfUrl("australia-oceania/new-zealand"),
  },
];

export function getGeofabrikRegion(id: string): GeofabrikRegion | undefined {
  return GEOFABRIK_REGIONS.find((r) => r.id === id);
}

export function estimateGeofabrikIngest(regionId: string): {
  downloadSizeMb: number;
  durationSeconds: number;
  propertyEstimate: number;
} {
  const region = getGeofabrikRegion(regionId);
  if (!region) {
    return { downloadSizeMb: 0, durationSeconds: 0, propertyEstimate: 0 };
  }
  // Rough national/state accommodation counts for preview only (~20 props / MB, clamped).
  const propertyEstimate = Math.min(
    80000,
    Math.max(5000, Math.round(region.downloadSizeMb * 20))
  );
  return {
    downloadSizeMb: region.downloadSizeMb,
    durationSeconds: region.estimatedMinutes * 60,
    propertyEstimate,
  };
}

/** Osmium tags-filter args for accommodation (matches Overpass ingest scope). */
export function buildOsmiumAccommodationFilterArgs(): string[] {
  const tourism = [
    "hotel",
    "hostel",
    "motel",
    "apartment",
    "guest_house",
    "chalet",
    "resort",
    "alpine_hut",
    "vacation_rental",
    "bed_and_breakfast",
  ];
  const args: string[] = [];
  for (const t of tourism) args.push(`nwr/tourism=${t}`);
  args.push("nwr/amenity=hotel");
  return args;
}

export function clipElementsToBbox<T extends { lat?: number; lon?: number }>(
  elements: T[],
  bbox: Bbox
): T[] {
  return elements.filter((el) => {
    if (el.lat == null || el.lon == null) return false;
    return containsPoint(bbox, el.lat, el.lon);
  });
}
