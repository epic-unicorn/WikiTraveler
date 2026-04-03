/**
 * lib/overpass.ts
 *
 * Fetches accessibility-tagged properties from the OpenStreetMap Overpass API
 * for a given bounding box, maps OSM tags to WikiTraveler AccessibilityFact
 * rows, and bulk-upserts them at OFFICIAL tier with sourceType OSM
 * (OSM-derived data). VERIFIED and CONFIRMED facts are never downgraded.
 *
 * Bounding box format: "lat_min,lon_min,lat_max,lon_max"
 * Default (Eindhoven, NL): OSM_BBOX=51.39,5.42,51.49,5.52
 *
 * Fixture support: if a cached JSON file path is provided, the Overpass API
 * is not called. The fixture is saved automatically on first fetch.
 */

import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import type { PrismaClient } from "@prisma/client";

// ---------------------------------------------------------------------------
// OSM data shapes
// ---------------------------------------------------------------------------

export interface OverpassElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

export interface OverpassResult {
  version?: number;
  generator?: string;
  elements: OverpassElement[];
}

// ---------------------------------------------------------------------------
// Accommodation filter — only ingest places to sleep
// ---------------------------------------------------------------------------

const ACCOMMODATION_TYPES = new Set([
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
]);

function isAccommodation(tags: Record<string, string>): boolean {
  return (
    ACCOMMODATION_TYPES.has(tags["tourism"] ?? "") ||
    tags["amenity"] === "hotel"
  );
}

// ---------------------------------------------------------------------------
// Tag whitelist — strip everything else before touching the DB
// ---------------------------------------------------------------------------

const ESSENTIAL_TAGS = new Set([
  "name",
  "name:en",
  "tourism",
  "amenity",
  "shop",
  "leisure",
  "wheelchair",
  "wheelchair:description",
  "ramp",
  "ramp:wheelchair",
  "ramp:stroller",
  "tactile_paving",
  "toilets:wheelchair",
  "hearing_loop",
  "door:width",
  "level",
  "addr:street",
  "addr:housenumber",
  "addr:city",
  "addr:postcode",
]);

// ---------------------------------------------------------------------------
// OSM tag → WikiTraveler fieldName mapping
// ---------------------------------------------------------------------------

const OSM_TO_FIELD: Record<string, string> = {
  wheelchair: "step_free_entrance",
  "wheelchair:description": "notes",
  "ramp:wheelchair": "ramp_present",
  ramp: "ramp_present",
  tactile_paving: "tactile_paving",
  "toilets:wheelchair": "accessible_bathroom",
  hearing_loop: "hearing_loop",
  "door:width": "door_width_cm",
};

// ---------------------------------------------------------------------------
// Value normalisation
// ---------------------------------------------------------------------------

function normalizeValue(osmKey: string, raw: string): string | null {
  if (osmKey === "door:width") {
    const match = raw.match(/[\d.]+/);
    if (!match) return null;
    const n = parseFloat(match[0]);
    // Values < 10 are assumed to be in metres → convert to cm
    return raw.includes("m") || n < 10
      ? String(Math.round(n * 100))
      : String(Math.round(n));
  }

  switch (raw) {
    case "yes":
      return "yes";
    case "no":
      return "no";
    case "limited":
      return "partial";
    case "unknown":
      return null; // skip — no useful information
    default:
      return raw.trim() || null;
  }
}

// ---------------------------------------------------------------------------
// Overpass QL query builder
// ---------------------------------------------------------------------------

function buildQuery(bbox: string): string {
  // Fetch only accommodation: hotels, hostels, motels, apartments, guest houses, etc.
  // `out body center` returns coordinates for both nodes and the centroid of ways.
  const types = [
    "hotel", "hostel", "motel", "apartment", "guest_house",
    "chalet", "resort", "alpine_hut", "vacation_rental", "bed_and_breakfast",
  ].join("|");
  return `[out:json][timeout:90];
(
  node["tourism"~"^(${types})$"](${bbox});
  way["tourism"~"^(${types})$"](${bbox});
  node["amenity"="hotel"](${bbox});
  way["amenity"="hotel"](${bbox});
);
out body center;`;
}

// ---------------------------------------------------------------------------
// Fetch from Overpass (or load cached fixture)
// ---------------------------------------------------------------------------

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];

export async function fetchOverpassData(
  bbox: string,
  fixturePath?: string
): Promise<OverpassResult> {
  if (fixturePath && existsSync(fixturePath)) {
    console.log(`[overpass] Loading fixture from ${fixturePath}`);
    const raw = await readFile(fixturePath, "utf-8");
    return JSON.parse(raw) as OverpassResult;
  }

  console.log(`[overpass] Fetching from Overpass API for bbox ${bbox}…`);
  const query = buildQuery(bbox);

  let lastError: Error | null = null;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      console.log(`[overpass] Trying ${endpoint}…`);
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `data=${encodeURIComponent(query)}`,
        signal: AbortSignal.timeout(120_000),
      });

      if (!res.ok) {
        lastError = new Error(`${endpoint} returned ${res.status}: ${await res.text()}`);
        console.warn(`[overpass] ${lastError.message.slice(0, 120)}`);
        continue;
      }

      const result = (await res.json()) as OverpassResult;

      // Auto-save fixture so subsequent resets don't need network access
      if (fixturePath) {
        await mkdir(join(fixturePath, ".."), { recursive: true });
        await writeFile(fixturePath, JSON.stringify(result, null, 2), "utf-8");
        console.log(`[overpass] Fixture saved to ${fixturePath}`);
      }

      return result;
    } catch (err) {
      lastError = err as Error;
      console.warn(`[overpass] ${endpoint} failed: ${lastError.message}`);
    }
  }

  throw lastError ?? new Error("All Overpass endpoints failed");
}

// ---------------------------------------------------------------------------
// Map a single element to fact rows (strips non-whitelisted tags)
// ---------------------------------------------------------------------------

export function mapElementToFacts(
  element: OverpassElement
): Array<{ fieldName: string; value: string }> {
  const tags = element.tags ?? {};
  const facts: Array<{ fieldName: string; value: string }> = [];

  for (const [osmKey, fieldName] of Object.entries(OSM_TO_FIELD)) {
    const raw = tags[osmKey];
    if (!raw) continue;
    const value = normalizeValue(osmKey, raw);
    if (value !== null) facts.push({ fieldName, value });
  }

  return facts;
}

// ---------------------------------------------------------------------------
// Haversine distance (metres) between two lat/lon pairs
// ---------------------------------------------------------------------------

function haversineMetres(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ---------------------------------------------------------------------------
// Ingest result — upserts Properties + AccessibilityFacts
// ---------------------------------------------------------------------------

export interface IngestStats {
  total: number;
  created: number;
  updated: number;
  deduped: number;
  skipped: number; // no name or no useful facts
}

export async function ingestOverpassResult(
  result: OverpassResult,
  sourceNodeId: string,
  prisma: PrismaClient
): Promise<IngestStats> {
  const stats: IngestStats = {
    total: result.elements.length,
    created: 0,
    updated: 0,
    deduped: 0,
    skipped: 0,
  };

  // Pre-load existing properties with lat/lon for spatial deduplication
  const existingProperties = await prisma.property.findMany({
    select: { id: true, name: true, osmId: true, lat: true, lon: true },
  });

  for (const element of result.elements) {
    const tags = element.tags ?? {};
    const name = (tags["name"] || tags["name:en"] || "").trim();

    // Skip unnamed elements — we can't create a meaningful property
    if (!name) {
      stats.skipped++;
      continue;
    }

    // Skip non-accommodation types (safety net for anything slipping past the query)
    if (!isAccommodation(tags)) {
      stats.skipped++;
      continue;
    }

    const lat = element.lat ?? element.center?.lat;
    const lon = element.lon ?? element.center?.lon;
    const osmId = String(element.id);

    // Build address string from addr:* tags
    const addrParts = [
      tags["addr:street"],
      tags["addr:housenumber"],
      tags["addr:postcode"],
      tags["addr:city"],
    ].filter(Boolean);
    const location = addrParts.length > 0 ? addrParts.join(" ") : name;

    // ── Deduplication ─────────────────────────────────────────────────────
    // 1. Primary: same OSM ID already imported
    let existingId = existingProperties.find((p) => p.osmId === osmId)?.id;

    // 2. Spatial: same name + within 5 m of an existing property
    if (!existingId && lat !== undefined && lon !== undefined) {
      const nearby = existingProperties.find(
        (p) =>
          p.name.toLowerCase() === name.toLowerCase() &&
          p.lat !== null &&
          p.lon !== null &&
          haversineMetres(lat, lon, p.lat!, p.lon!) < 5
      );
      if (nearby) {
        existingId = nearby.id;
        stats.deduped++;
      }
    }

    const facts = mapElementToFacts(element);
    // Always create accommodation properties even with 0 facts —
    // they are still useful for name-based search matching.

    // ── Upsert Property ───────────────────────────────────────────────────
    let propertyId: string;

    if (existingId) {
      // Update coordinates if they are now known
      if (lat !== undefined && lon !== undefined) {
        await prisma.property.update({
          where: { id: existingId },
          data: { lat, lon, osmId: osmId },
        });
      }
      propertyId = existingId;
      stats.updated++;
    } else {
      const created = await prisma.property.create({
        data: {
          canonicalId: `osm:${osmId}`,
          name,
          location,
          lat: lat ?? null,
          lon: lon ?? null,
          osmId,
          dataSource: "IMPORTED_OSM",
        },
      });
      // Add to in-memory list so subsequent iterations can spatial-dedup against it
      existingProperties.push({
        id: created.id,
        name: created.name,
        osmId: created.osmId,
        lat: created.lat,
        lon: created.lon,
      });
      propertyId = created.id;
      stats.created++;
    }

    if (facts.length === 0) continue;

    // ── Upsert Facts (never downgrade VERIFIED / CONFIRMED) ───────────────
    const existing = await prisma.accessibilityFact.findMany({
      where: { propertyId },
      select: { fieldName: true, tier: true },
    });
    const protected_ = new Set(
      existing
        .filter((f) => f.tier === "VERIFIED" || f.tier === "CONFIRMED")
        .map((f) => f.fieldName)
    );

    for (const { fieldName, value } of facts) {
      if (protected_.has(fieldName)) continue;

      await prisma.accessibilityFact.upsert({
        where: {
          propertyId_fieldName_sourceNodeId: {
            propertyId,
            fieldName,
            sourceNodeId,
          },
        },
        update: { value, timestamp: new Date() },
        create: {
          propertyId,
          fieldName,
          value,
          tier: "OFFICIAL",
          sourceType: "OSM",
          sourceNodeId,
          submittedBy: "osm-ingest",
        },
      });
    }
  }

  return stats;
}
