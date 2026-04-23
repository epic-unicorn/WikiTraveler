import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { NODE_ID, NODE_REGION } from "@/lib/nodeInfo";
import { requireRole } from "@/lib/auth";
import type { NextRequest } from "next/server";

/**
 * GET /api/admin/backup
 *
 * Streams a full JSON backup of all node data.
 * Includes the latest applied Prisma migration name so restore can
 * detect schema mismatches.
 *
 * Protected by ADMIN_SECRET env var (Bearer token).
 */
export async function GET(req: NextRequest) {
  const authError = await requireRole(req, "ADMIN");
  if (authError) return authError;

  // Get the latest applied migration from Prisma's internal table
  let migration = "unknown";
  try {
    const result = await prisma.$queryRaw<{ migration_name: string }[]>`
      SELECT migration_name FROM "_prisma_migrations"
      WHERE finished_at IS NOT NULL
      ORDER BY finished_at DESC
      LIMIT 1
    `;
    migration = result[0]?.migration_name ?? "unknown";
  } catch { /* table may not exist in some setups */ }

  const [properties, facts, audits, peers, osmSyncState] = await Promise.all([
    prisma.property.findMany(),
    prisma.accessibilityFact.findMany(),
    prisma.auditSubmission.findMany(),
    prisma.nodePeer.findMany(),
    prisma.osmSyncState.findMany(),
  ]);

  const backup = {
    version: 1,
    createdAt: new Date().toISOString(),
    migration,
    nodeId: NODE_ID,
    region: NODE_REGION,
    data: { properties, facts, audits, peers, osmSyncState },
  };

  return new NextResponse(JSON.stringify(backup, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="wikitraveler-backup-${NODE_ID}-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}


