/**
 * lib/wheelmap.ts
 *
 * Adapter for the Wheelmap / OpenStreetMap accessibility API.
 * Docs: https://wheelmap.org/de/api/docs
 *
 * Usage:
 *   - Requires WHEELMAP_API_KEY env var.
 *   - Fetches a single Wheelmap node by its OSM node ID and maps
 *     the wheelchair rating + description to WikiTraveler AccessibilityFact
 *     rows at OFFICIAL tier with sourceType WHEELMAP.
 *   - Called by the wheelmap-sync cron.
 */

import { prisma } from "@/lib/prisma";
import { NODE_ID } from "@/lib/nodeInfo";

const WHEELMAP_API = "https://wheelmap.org/api/0.1";
const SOURCE_NODE = `${NODE_ID}:wheelmap`;

// ---------------------------------------------------------------------------
// Wheelmap API shapes (subset)
// ---------------------------------------------------------------------------

interface WheelmapNode {
  id: number;
  name: string | null;
  wheelchair: "yes" | "limited" | "no" | "unknown" | null;
  wheelchair_description: string | null;
  wheelchair_toilet: "yes" | "limited" | "no" | "unknown" | null;
  lat: number;
  lon: number;
}

interface WheelmapNodeResponse {
  node: WheelmapNode;
}

// ---------------------------------------------------------------------------
// Field mapping
// ---------------------------------------------------------------------------

/**
 * Maps a Wheelmap wheelchair rating to a boolean-ish string value used in
 * WikiTraveler facts.
 */
function ratingToValue(rating: WheelmapNode["wheelchair"] | WheelmapNode["wheelchair_toilet"]): string | null {
  switch (rating) {
    case "yes":     return "true";
    case "limited": return "partial";
    case "no":      return "false";
    default:        return null; // "unknown" / null — skip
  }
}

/**
 * Converts a WheelmapNode to an array of { fieldName, value } pairs
 * using WikiTraveler's ACCESSIBILITY_FIELDS vocabulary.
 */
function mapNodeToFacts(node: WheelmapNode): Array<{ fieldName: string; value: string }> {
  const facts: Array<{ fieldName: string; value: string }> = [];

  const stepFree = ratingToValue(node.wheelchair);
  if (stepFree !== null) {
    facts.push({ fieldName: "step_free_entrance", value: stepFree });
    // If we know step-free entrance exists, also infer ramp_present for "yes"
    if (node.wheelchair === "yes") {
      facts.push({ fieldName: "ramp_present", value: "true" });
    }
  }

  const toilet = ratingToValue(node.wheelchair_toilet);
  if (toilet !== null) {
    facts.push({ fieldName: "accessible_bathroom", value: toilet });
  }

  if (node.wheelchair_description?.trim()) {
    facts.push({ fieldName: "notes", value: node.wheelchair_description.trim() });
  }

  return facts;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface WheelmapSyncResult {
  propertyId: string;
  wheelmapId: string;
  factsUpserted: number;
  skipped: number;
}

/**
 * Fetches fresh Wheelmap data for a single property and upserts the resulting
 * OFFICIAL-tier facts. Facts at COMMUNITY or MESH_TRUTH tier are never
 * downgraded.
 */
export async function syncPropertyFromWheeelmap(
  propertyId: string,
  wheelmapId: string
): Promise<WheelmapSyncResult> {
  const apiKey = process.env.WHEELMAP_API_KEY;
  if (!apiKey) throw new Error("WHEELMAP_API_KEY is not configured on this node.");

  const url = `${WHEELMAP_API}/nodes/${wheelmapId}.json?api_key=${encodeURIComponent(apiKey)}`;

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  });

  if (res.status === 404) {
    // Node no longer exists on Wheelmap — skip gracefully
    return { propertyId, wheelmapId, factsUpserted: 0, skipped: 0 };
  }
  if (!res.ok) {
    throw new Error(`Wheelmap API error ${res.status} for node ${wheelmapId}`);
  }

  const body = (await res.json()) as WheelmapNodeResponse;
  const node = body.node;
  const incomingFacts = mapNodeToFacts(node);

  if (incomingFacts.length === 0) {
    return { propertyId, wheelmapId, factsUpserted: 0, skipped: 0 };
  }

  // Fetch existing facts so we never downgrade higher-tier data
  const existing = await prisma.accessibilityFact.findMany({
    where: { propertyId },
    select: { fieldName: true, tier: true },
  });
  const protectedFields = new Set(
    existing
      .filter((f) => f.tier === "COMMUNITY" || f.tier === "MESH_TRUTH")
      .map((f) => f.fieldName)
  );

  let upserted = 0;
  let skipped = 0;

  for (const { fieldName, value } of incomingFacts) {
    if (protectedFields.has(fieldName)) {
      skipped++;
      continue;
    }

    await prisma.accessibilityFact.upsert({
      where: {
        propertyId_fieldName_sourceNodeId: {
          propertyId,
          fieldName,
          sourceNodeId: SOURCE_NODE,
        },
      },
      update: {
        value,
        timestamp: new Date(),
      },
      create: {
        propertyId,
        fieldName,
        value,
        tier: "OFFICIAL",
        sourceType: "WHEELMAP",
        sourceNodeId: SOURCE_NODE,
        submittedBy: "wheelmap-sync",
      },
    });

    upserted++;
  }

  return { propertyId, wheelmapId, factsUpserted: upserted, skipped };
}

/**
 * Looks up a property on Wheelmap by name + approximate lat/lng bounding box
 * and returns the best-matching node ID, or null if none found.
 *
 * Useful for the one-time linking step (associating an amadeusId property with
 * a wheelmapId when no manual mapping exists yet).
 *
 * bbox is [lon_min, lat_min, lon_max, lat_max] in decimal degrees.
 */
export async function findWheelmapNode(
  name: string,
  bbox: [number, number, number, number]
): Promise<string | null> {
  const apiKey = process.env.WHEELMAP_API_KEY;
  if (!apiKey) throw new Error("WHEELMAP_API_KEY is not configured on this node.");

  const [lonMin, latMin, lonMax, latMax] = bbox;
  const params = new URLSearchParams({
    api_key: apiKey,
    bbox: `${lonMin},${latMin},${lonMax},${latMax}`,
    per_page: "10",
  });

  const res = await fetch(`${WHEELMAP_API}/nodes.json?${params}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) throw new Error(`Wheelmap search failed: ${res.status}`);

  const data = (await res.json()) as { nodes: WheelmapNode[] };
  const nodes: WheelmapNode[] = data.nodes ?? [];

  // Fuzzy name match — lower-case prefix or contains
  const lowerName = name.toLowerCase();
  const match = nodes.find(
    (n) => n.name && n.name.toLowerCase().includes(lowerName)
  );

  return match ? String(match.id) : null;
}
