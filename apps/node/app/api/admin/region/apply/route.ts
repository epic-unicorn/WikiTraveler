import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { isChunkedIngestMode } from "@/lib/bbox";
import {
  createIngestJob,
  failStaleIngestJobs,
  getActiveIngestJob,
  planRegionApply,
  startIngestJob,
} from "@/lib/ingestJob";
import { deriveRegionLabel } from "@/lib/geocode";
import { validateRegionBbox, findPresetByBbox } from "@/lib/regionPresets";
import { commitNodeBbox, setAuditedReimportPending } from "@/lib/nodeSettings";
import { formatBbox } from "@/lib/bbox";
import { prisma } from "@/lib/prisma";
import { purgeGossipOutsideBbox, purgeOutsideBbox } from "@/lib/regionPurge";
import type { NextRequest } from "next/server";

/**
 * POST /api/admin/region/apply
 * Body: { bbox, presetId?, exportConfirmed?, reingest?, saveOnly? }
 */
export async function POST(req: NextRequest) {
  const authError = await requireRole(req, "ADMIN");
  if (authError) return authError;

  await failStaleIngestJobs();
  const active = await getActiveIngestJob();
  if (active) {
    return NextResponse.json(
      { message: "An ingest job is already running.", jobId: active.id },
      { status: 409 }
    );
  }

  let body: {
    bbox?: string;
    presetId?: string;
    exportConfirmed?: boolean;
    reingest?: boolean;
    saveOnly?: boolean;
  };
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

  const effectivePresetId =
    body.presetId ?? findPresetByBbox(formatBbox(validated.bbox))?.id ?? undefined;

  if (plan.ingestMode === "geofabrik" && isChunkedIngestMode() && !body.saveOnly) {
    return NextResponse.json(
      {
        message:
          "Geofabrik import requires a long-running server (Docker/VPS) with osmium-tool — not Vercel serverless.",
      },
      { status: 400 }
    );
  }

  if (plan.changeType === "unchanged") {
    if (body.reingest) {
      const jobId = await createIngestJob(validated.bbox, "refresh");
      startIngestJob(jobId);
      return NextResponse.json({ jobId, changeType: "refresh" });
    }
    return NextResponse.json({
      message: "Bbox unchanged. Use Re-ingest to download OSM data again.",
      changeType: "unchanged",
    });
  }

  if (body.saveOnly) {
    if (plan.requiresExport && !body.exportConfirmed) {
      return NextResponse.json(
        {
          message: "Export audited data and confirm before moving to a new region.",
          requiresExport: true,
          changeType: plan.changeType,
        },
        { status: 400 }
      );
    }

    const regionLabel = await deriveRegionLabel(validated.bbox, effectivePresetId);
    await commitNodeBbox(validated.bbox, regionLabel, effectivePresetId);

    if (plan.changeType === "shrink") {
      await purgeOutsideBbox(prisma, validated.bbox);
      await purgeGossipOutsideBbox(prisma, validated.bbox);
      await setAuditedReimportPending(false);
    } else if (plan.changeType === "move") {
      await setAuditedReimportPending(true);
    } else {
      await setAuditedReimportPending(false);
    }

    return NextResponse.json({
      changeType: plan.changeType,
      savedOnly: true,
      ingestMode: plan.ingestMode,
    });
  }

  if (plan.requiresExport && !body.exportConfirmed) {
    return NextResponse.json(
      {
        message: "Export audited data and confirm before moving to a new region.",
        requiresExport: true,
        changeType: plan.changeType,
      },
      { status: 400 }
    );
  }

  const regionLabel = await deriveRegionLabel(validated.bbox, effectivePresetId);

  if (plan.changeType === "shrink") {
    await commitNodeBbox(validated.bbox, regionLabel, effectivePresetId);
    await setAuditedReimportPending(false);
    const jobId = await createIngestJob(validated.bbox, plan.changeType);
    startIngestJob(jobId);
    return NextResponse.json({ jobId, changeType: plan.changeType });
  }

  await commitNodeBbox(validated.bbox, regionLabel, effectivePresetId);

  const jobId =
    plan.ingestMode === "geofabrik" && plan.geofabrikId
      ? await createIngestJob(validated.bbox, "pbf-import", { geofabrikId: plan.geofabrikId })
      : await createIngestJob(validated.bbox, plan.changeType);

  await setAuditedReimportPending(plan.changeType === "move");
  startIngestJob(jobId);
  return NextResponse.json({
    jobId,
    changeType: plan.changeType,
    ingestMode: plan.ingestMode,
  });
}
