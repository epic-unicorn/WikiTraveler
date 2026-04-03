import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { gzip } from "zlib";
import { promisify } from "util";
import type { NextRequest } from "next/server";

const gzipAsync = promisify(gzip);

/**
 * GET /api/export
 *
 * Exports all properties and accessibility facts as a gzip-compressed JSON
 * file. The recipient node can import this via POST /api/import to "hydrate"
 * its database without fetching records one-by-one.
 *
 * Response: application/gzip  (wikitraveler-export.json.gz)
 *
 * Protected by CRON_SECRET when set (same token as cron endpoints).
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
  }

  const [properties, facts] = await Promise.all([
    prisma.property.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.accessibilityFact.findMany({ orderBy: { timestamp: "asc" } }),
  ]);

  const payload = {
    exportedAt: new Date().toISOString(),
    schemaVersion: 1,
    properties,
    facts,
  };

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
