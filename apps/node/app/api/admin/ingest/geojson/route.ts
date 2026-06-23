import { randomUUID } from "crypto";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { parseBbox } from "@/lib/bbox";
import { createIngestJob, getActiveIngestJob, startIngestJob } from "@/lib/ingestJob";
import type { NextRequest } from "next/server";

/**
 * POST /api/admin/ingest/geojson
 * multipart/form-data: file (GeoJSON or geojsonseq), bbox (minLat,minLon,maxLat,maxLon)
 */
export async function POST(req: NextRequest) {
  const authError = await requireRole(req, "ADMIN");
  if (authError) return authError;

  const active = await getActiveIngestJob();
  if (active) {
    return NextResponse.json(
      { message: "An ingest job is already running.", jobId: active.id },
      { status: 409 }
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ message: "Expected multipart form data" }, { status: 400 });
  }

  const file = form.get("file");
  const bboxRaw = form.get("bbox");
  if (!file || typeof file === "string") {
    return NextResponse.json({ message: "Missing file" }, { status: 400 });
  }
  if (!bboxRaw || typeof bboxRaw !== "string") {
    return NextResponse.json({ message: "Missing bbox" }, { status: 400 });
  }

  const bbox = parseBbox(bboxRaw);
  if (!bbox) {
    return NextResponse.json({ message: "Invalid bbox format" }, { status: 400 });
  }

  const cacheDir =
    process.env.GEOFABRIK_CACHE_DIR != null
      ? join(process.env.GEOFABRIK_CACHE_DIR, "geojson-imports")
      : join(process.cwd(), ".cache", "geojson-imports");
  mkdirSync(cacheDir, { recursive: true });

  const filePath = join(cacheDir, `${randomUUID()}.geojson`);
  const buffer = Buffer.from(await file.arrayBuffer());
  writeFileSync(filePath, buffer);

  const jobId = await createIngestJob(bbox, "geojson-import", { geojsonPath: filePath });
  startIngestJob(jobId);

  return NextResponse.json({ jobId, changeType: "geojson-import" });
}
