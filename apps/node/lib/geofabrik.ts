import type { Bbox } from "@/lib/bbox";
import { containsPoint } from "@/lib/bbox";

/** Geofabrik extract regions — large countries impractical for tiled Overpass. */
export interface GeofabrikRegion {
  id: string;
  label: string;
  bbox: Bbox;
  /** Approximate .osm.pbf download size for admin preview. */
  downloadSizeMb: number;
  /** Rough ingest duration on a typical VPS. */
  estimatedMinutes: number;
  url: string;
}

const BASE = "https://download.geofabrik.de";

export const GEOFABRIK_REGIONS: GeofabrikRegion[] = [
  {
    id: "netherlands",
    label: "Netherlands",
    bbox: [50.75, 3.36, 53.55, 7.23],
    downloadSizeMb: 1300,
    estimatedMinutes: 25,
    url: `${BASE}/europe/netherlands-latest.osm.pbf`,
  },
  {
    id: "belgium",
    label: "Belgium",
    bbox: [49.5, 2.54, 51.51, 6.41],
    downloadSizeMb: 520,
    estimatedMinutes: 20,
    url: `${BASE}/europe/belgium-latest.osm.pbf`,
  },
  {
    id: "luxembourg",
    label: "Luxembourg",
    bbox: [49.44, 5.73, 50.18, 6.53],
    downloadSizeMb: 40,
    estimatedMinutes: 5,
    url: `${BASE}/europe/luxembourg-latest.osm.pbf`,
  },
  {
    id: "ireland",
    label: "Ireland",
    bbox: [51.4, -10.5, 55.4, -5.9],
    downloadSizeMb: 240,
    estimatedMinutes: 15,
    url: `${BASE}/europe/ireland-and-northern-ireland-latest.osm.pbf`,
  },
  {
    id: "portugal",
    label: "Portugal",
    bbox: [36.9, -9.5, 42.2, -6.2],
    downloadSizeMb: 320,
    estimatedMinutes: 18,
    url: `${BASE}/europe/portugal-latest.osm.pbf`,
  },
  {
    id: "switzerland",
    label: "Switzerland",
    bbox: [45.8, 5.9, 47.8, 10.5],
    downloadSizeMb: 430,
    estimatedMinutes: 20,
    url: `${BASE}/europe/switzerland-latest.osm.pbf`,
  },
  {
    id: "austria",
    label: "Austria",
    bbox: [46.4, 9.5, 49.0, 17.2],
    downloadSizeMb: 720,
    estimatedMinutes: 25,
    url: `${BASE}/europe/austria-latest.osm.pbf`,
  },
  {
    id: "france",
    label: "France",
    bbox: [41.33, -5.14, 51.09, 9.56],
    downloadSizeMb: 890,
    estimatedMinutes: 45,
    url: `${BASE}/europe/france-latest.osm.pbf`,
  },
  {
    id: "germany",
    label: "Germany",
    bbox: [47.27, 5.87, 55.06, 15.04],
    downloadSizeMb: 790,
    estimatedMinutes: 40,
    url: `${BASE}/europe/germany-latest.osm.pbf`,
  },
  {
    id: "spain",
    label: "Spain",
    bbox: [36.0, -9.3, 43.8, 4.3],
    downloadSizeMb: 650,
    estimatedMinutes: 35,
    url: `${BASE}/europe/spain-latest.osm.pbf`,
  },
  {
    id: "italy",
    label: "Italy",
    bbox: [36.6, 6.6, 47.1, 18.5],
    downloadSizeMb: 720,
    estimatedMinutes: 40,
    url: `${BASE}/europe/italy-latest.osm.pbf`,
  },
  {
    id: "great-britain",
    label: "Great Britain",
    bbox: [49.9, -8.65, 60.86, 1.77],
    downloadSizeMb: 820,
    estimatedMinutes: 45,
    url: `${BASE}/europe/great-britain-latest.osm.pbf`,
  },
  {
    id: "poland",
    label: "Poland",
    bbox: [49.0, 14.1, 54.8, 24.2],
    downloadSizeMb: 520,
    estimatedMinutes: 30,
    url: `${BASE}/europe/poland-latest.osm.pbf`,
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
  return {
    downloadSizeMb: region.downloadSizeMb,
    durationSeconds: region.estimatedMinutes * 60,
    // Rough national accommodation counts for preview only
    propertyEstimate:
      regionId === "france"
        ? 45000
        : regionId === "germany"
          ? 40000
          : 25000,
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
