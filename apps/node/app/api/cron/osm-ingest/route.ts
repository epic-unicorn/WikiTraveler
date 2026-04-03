import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { NODE_ID } from "@/lib/nodeInfo";
import { fetchOverpassData, ingestOverpassResult } from "@/lib/overpass";
import type { NextRequest } from "next/server";

/**
 * GET /api/cron/osm-ingest
 *
 * Fetches accessibility-tagged properties from the Overpass API for the
 * configured bounding box (OSM_BBOX) and bulk-upserts them into the database
 * at OFFICIAL tier with sourceType WHEELMAP.
 *
 * Delta guard: if the bbox was synced within the last 7 days this run is
 * skipped to avoid hammering the Overpass API. Override with ?force=1.
 *
 * Protected by CRON_SECRET when set.
 *
 * Env vars:
 *   OSM_BBOX          "lat_min,lon_min,lat_max,lon_max" (default: Eindhoven)
 *   OSM_FIXTURE_PATH  absolute path to a cached Overpass JSON fixture file
 *   CRON_SECRET       optional bearer token guard
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
  }

  const bbox = process.env.OSM_BBOX ?? "51.39,5.42,51.49,5.52";
  const fixturePath = process.env.OSM_FIXTURE_PATH;
  const force = req.nextUrl.searchParams.get("force") === "1";

  // ── Delta guard ────────────────────────────────────────────────────────────
  if (!force) {
    const state = await prisma.osmSyncState.findUnique({ where: { bbox } });
    if (state?.lastSync) {
      const ageMs = Date.now() - state.lastSync.getTime();
      const ageDays = ageMs / (1000 * 60 * 60 * 24);
      if (ageDays < 7) {
        return NextResponse.json({
          message: `Skipped — last sync was ${ageDays.toFixed(1)} days ago (< 7-day threshold). Add ?force=1 to override.`,
          lastSync: state.lastSync,
          bbox,
        });
      }
    }
  }

  const started = Date.now();

  try {
    const result = await fetchOverpassData(bbox, fixturePath);
    const stats = await ingestOverpassResult(result, `${NODE_ID}:osm`, prisma);

    // Record sync timestamp
    await prisma.osmSyncState.upsert({
      where: { bbox },
      update: { lastSync: new Date(), itemCount: result.elements.length },
      create: { bbox, lastSync: new Date(), itemCount: result.elements.length },
    });

    return NextResponse.json({
      ok: true,
      bbox,
      durationMs: Date.now() - started,
      elements: result.elements.length,
      ...stats,
    });
  } catch (err) {
    console.error("[osm-ingest] Failed:", err);
    return NextResponse.json(
      { ok: false, message: String(err) },
      { status: 500 }
    );
  }
}
