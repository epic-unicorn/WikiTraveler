import { NextResponse } from "next/server";
import { gunzip } from "zlib";
import { promisify } from "util";
import { requireRole } from "@/lib/auth";
import { importExportPayload, type ExportPayload } from "@/lib/nodeDataTransfer";
import type { NextRequest } from "next/server";


export { dynamic } from "@/lib/apiRoute";
const gunzipAsync = promisify(gunzip);

/**
 * POST /api/import — gzip JSON peer hydration (AUDITOR+).
 */
export async function POST(req: NextRequest) {
  const authError = await requireRole(req, "AUDITOR");
  if (authError) return authError;

  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.includes("application/gzip")) {
    return NextResponse.json(
      { message: "Expected Content-Type: application/gzip" },
      { status: 415 }
    );
  }

  let payload: ExportPayload;
  try {
    const compressed = Buffer.from(await req.arrayBuffer());
    const json = await gunzipAsync(compressed);
    payload = JSON.parse(json.toString("utf-8")) as ExportPayload;
  } catch {
    return NextResponse.json(
      { message: "Failed to decompress or parse import file" },
      { status: 400 }
    );
  }

  try {
    const result = await importExportPayload(payload);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { message: err instanceof Error ? err.message : String(err) },
      { status: 422 }
    );
  }
}
