import { NextResponse } from "next/server";
import { gunzip } from "zlib";
import { promisify } from "util";
import { requireRole } from "@/lib/auth";
import { importExportPayload, type ExportPayload } from "@/lib/nodeDataTransfer";
import { recordIngestComplete } from "@/lib/nodeSettings";
import type { NextRequest } from "next/server";

const gunzipAsync = promisify(gunzip);

/**
 * POST /api/admin/import
 * Import gzip JSON export (ADMIN only).
 */
export async function POST(req: NextRequest) {
  const authError = await requireRole(req, "ADMIN");
  if (authError) return authError;

  const contentType = req.headers.get("content-type") ?? "";
  let payload: ExportPayload;

  try {
    const raw = Buffer.from(await req.arrayBuffer());
    if (contentType.includes("application/gzip")) {
      const json = await gunzipAsync(raw);
      payload = JSON.parse(json.toString("utf-8")) as ExportPayload;
    } else {
      payload = JSON.parse(raw.toString("utf-8")) as ExportPayload;
    }
  } catch {
    return NextResponse.json(
      { message: "Failed to parse import file (expected .json.gz or .json)" },
      { status: 400 }
    );
  }

  try {
    const result = await importExportPayload(payload);
    if (result.propertiesUpserted > 0) {
      await recordIngestComplete(result.propertiesUpserted);
    }
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { message: err instanceof Error ? err.message : String(err) },
      { status: 422 }
    );
  }
}
