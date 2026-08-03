import { NextResponse } from "next/server";
import { gzip } from "zlib";
import { promisify } from "util";
import { buildExportPayload } from "@/lib/nodeDataTransfer";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const gzipAsync = promisify(gzip);

/**
 * GET /api/export — gzip JSON export (CRON_SECRET when set).
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
  }

  const payload = await buildExportPayload();
  const compressed = await gzipAsync(Buffer.from(JSON.stringify(payload), "utf-8"));

  return new NextResponse(compressed, {
    status: 200,
    headers: {
      "Content-Type": "application/gzip",
      "Content-Disposition": 'attachment; filename="wikitraveler-export.json.gz"',
      "Content-Length": String(compressed.byteLength),
    },
  });
}
