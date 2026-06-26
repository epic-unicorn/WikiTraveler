import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { join } from "path";
import { existsSync } from "fs";
import { prisma } from "@/lib/prisma";
import { NODE_ID } from "@/lib/nodeInfo";
import { parseBbox, formatBbox } from "@/lib/bbox";
import { fetchOverpassData, ingestOverpassResult } from "@/lib/overpass";
import { getNodeBbox, recordIngestComplete } from "@/lib/nodeSettings";

/**
 * POST /api/dev/reingest   (GOSSIP_DEV gated, no auth)
 *
 * Re-runs OSM ingest for the node's configured bbox using the committed
 * fixture (scripts/fixtures/osm-<bbox>.json). Demonstrates that an OSM refresh
 * updates only base metadata and leaves manual metadata overrides intact.
 *
 * Query params:
 *   bbox=minLat,minLon,maxLat,maxLon   override the configured region
 *   live=1                             allow a live Overpass fetch if no fixture
 */
export async function POST(req: NextRequest) {
  if (process.env.GOSSIP_DEV !== "true" && process.env.NODE_ENV === "production") {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  const bboxParam = req.nextUrl.searchParams.get("bbox");
  const allowLive = req.nextUrl.searchParams.get("live") === "1";

  const bboxRaw = bboxParam ?? (await getNodeBbox());
  if (!bboxRaw) {
    return NextResponse.json(
      { message: "No region configured — set a bbox in Admin or pass ?bbox=" },
      { status: 422 }
    );
  }

  const bbox = parseBbox(bboxRaw);
  if (!bbox) {
    return NextResponse.json({ message: `Invalid bbox: ${bboxRaw}` }, { status: 422 });
  }

  const bboxStr = formatBbox(bbox);
  const fixtureName = `osm-${bboxStr.replace(/[^0-9.]/g, "_")}.json`;
  // `next dev` runs with cwd = apps/node, but committed fixtures live at the
  // repo root (scripts/fixtures). Check both so this resolves in dev, Docker,
  // and CI regardless of the working directory.
  const fixtureCandidates = [
    join(process.cwd(), "scripts", "fixtures", fixtureName),
    join(process.cwd(), "..", "..", "scripts", "fixtures", fixtureName),
  ];
  const fixturePath = fixtureCandidates.find((p) => existsSync(p)) ?? fixtureCandidates[1]!;
  const haveFixture = existsSync(fixturePath);

  // Without a fixture we'd have to hit the live Overpass API. Don't do that
  // implicitly — it requires a valid bbox query and network access. Fail with
  // a clear message unless the caller explicitly opted into a live fetch.
  if (!haveFixture && !allowLive) {
    return NextResponse.json(
      {
        message: `No committed fixture for bbox ${bboxStr} (looked for ${fixtureName}).`,
        hint: "Pass ?live=1 (or GOSSIP_REINGEST_LIVE=1) to fetch from Overpass, or configure a region that has a fixture under scripts/fixtures.",
      },
      { status: 422 }
    );
  }

  const overridesBefore = await prisma.propertyMetadataOverride.count();

  let result;
  try {
    // Prefer the fixture; only hit the network (with a valid bbox) when no
    // fixture exists and live was explicitly allowed.
    result = await fetchOverpassData(haveFixture ? "" : bboxStr, fixturePath);
  } catch (err) {
    return NextResponse.json(
      {
        message: `OSM re-ingest failed: ${err instanceof Error ? err.message : String(err)}`,
        hint: `Expected fixture at ${fixturePath}. Pass ?live=1 to fetch from Overpass.`,
      },
      { status: 502 }
    );
  }

  const stats = await ingestOverpassResult(result, `${NODE_ID}:osm`, prisma);
  await recordIngestComplete(result.elements.length);

  const [propertyCount, overridesAfter] = await Promise.all([
    prisma.property.count(),
    prisma.propertyMetadataOverride.count(),
  ]);

  return NextResponse.json({
    ok: true,
    nodeId: NODE_ID,
    bbox: bboxStr,
    source: result.elements.length > 0 ? "fixture-or-live" : "empty",
    elements: result.elements.length,
    stats,
    propertyCount,
    overridesPreserved: overridesAfter >= overridesBefore,
    overrideCount: overridesAfter,
  });
}
