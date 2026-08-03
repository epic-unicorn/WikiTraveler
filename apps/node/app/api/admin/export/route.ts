import { NextResponse } from "next/server";
import { gzip } from "zlib";
import { promisify } from "util";
import { requireRole } from "@/lib/auth";
import { buildExportPayload } from "@/lib/nodeDataTransfer";
import type { NextRequest } from "next/server";


export const dynamic = "force-dynamic";
const gzipAsync = promisify(gzip);

/**
 * GET /api/admin/export
 * Export all properties and facts as gzip JSON (ADMIN only).
 */
export async function GET(req: NextRequest) {
  const authError = await requireRole(req, "ADMIN");
  if (authError) return authError;

  const payload = await buildExportPayload();
  const json = JSON.stringify(payload);
  const compressed = await gzipAsync(Buffer.from(json, "utf-8"));

  return new NextResponse(compressed, {
    status: 200,
    headers: {
      "Content-Type": "application/gzip",
      "Content-Disposition": 'attachment; filename="wikitraveler-export.json.gz"',
      "Content-Length": String(compressed.byteLength),
    },
  });
}
