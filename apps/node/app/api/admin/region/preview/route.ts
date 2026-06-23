import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { estimateGeofabrikIngest } from "@/lib/geofabrik";
import { planRegionApply } from "@/lib/ingestJob";
import { estimateIngestPreview, estimateTiledIngestPreviewSampled } from "@/lib/overpass";
import { validateRegionBbox } from "@/lib/regionPresets";
import { countPropertiesInsideBbox } from "@/lib/regionPurge";
import { prisma } from "@/lib/prisma";
import type { NextRequest } from "next/server";

/**
 * POST /api/admin/region/preview
 * Body: { bbox: string, presetId?: string }
 */
export async function POST(req: NextRequest) {
  const authError = await requireRole(req, "ADMIN");
  if (authError) return authError;

  let body: { bbox?: string; presetId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }

  const validated = validateRegionBbox(body.bbox ?? "", body.presetId);
  if (!validated.ok) {
    return NextResponse.json({ message: validated.message }, { status: 400 });
  }

  const plan = await planRegionApply(validated.bbox, body.presetId);
  const propertiesInside = await countPropertiesInsideBbox(prisma, validated.bbox);

  let ingestEstimate = null;
  if (plan.requiresIngest) {
    try {
      if (plan.ingestMode === "geofabrik" && plan.geofabrikId) {
        const est = estimateGeofabrikIngest(plan.geofabrikId);
        ingestEstimate = {
          isEstimate: true as const,
          isGeofabrik: true as const,
          elementCount: null,
          propertyEstimate: est.propertyEstimate,
          downloadSizeKb: est.downloadSizeMb * 1024,
          downloadSizeMb: est.downloadSizeMb,
          durationSeconds: est.durationSeconds,
        };
      } else if (plan.tileCount === 1) {
        ingestEstimate = await estimateIngestPreview(body.bbox!);
      } else {
        ingestEstimate = await estimateTiledIngestPreviewSampled(
          body.bbox!,
          plan.tileCount,
          plan.estimatedDurationSec
        );
      }
    } catch (err) {
      ingestEstimate = {
        elementCount: null,
        propertyEstimate: null,
        downloadSizeKb: null,
        durationSeconds: null,
        isEstimate: true as const,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  return NextResponse.json({
    bbox: body.bbox,
    ...plan,
    propertiesInside,
    ingestEstimate,
  });
}
