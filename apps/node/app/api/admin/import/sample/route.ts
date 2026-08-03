import { readFile } from "fs/promises";
import { join } from "path";
import { NextResponse } from "next/server";
import { gunzip } from "zlib";
import { promisify } from "util";
import { requireRole } from "@/lib/auth";
import { importExportPayload, type ExportPayload } from "@/lib/nodeDataTransfer";
import { commitNodeBbox, recordIngestComplete } from "@/lib/nodeSettings";
import type { NextRequest } from "next/server";


export const dynamic = "force-dynamic";
const gunzipAsync = promisify(gunzip);

const EINDHOVEN_BBOX: [number, number, number, number] = [51.39, 5.42, 51.49, 5.52];

/**
 * POST /api/admin/import/sample
 * One-click import of bundled Eindhoven sample data.
 */
export async function POST(req: NextRequest) {
  const authError = await requireRole(req, "ADMIN");
  if (authError) return authError;

  const samplePath = join(process.cwd(), "public", "samples", "eindhoven.json.gz");
  let payload: ExportPayload;
  try {
    const compressed = await readFile(samplePath);
    const json = await gunzipAsync(compressed);
    payload = JSON.parse(json.toString("utf-8")) as ExportPayload;
  } catch {
    return NextResponse.json(
      { message: "Sample data not found. Run pnpm node:build-sample first." },
      { status: 404 }
    );
  }

  try {
    await commitNodeBbox(EINDHOVEN_BBOX, "Eindhoven", "eindhoven");
    const result = await importExportPayload(payload);
    await recordIngestComplete(result.propertiesUpserted);
    return NextResponse.json({ ok: true, ...result, region: "Eindhoven" });
  } catch (err) {
    return NextResponse.json(
      { message: err instanceof Error ? err.message : String(err) },
      { status: 422 }
    );
  }
}
