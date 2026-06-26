import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import type { NextRequest } from "next/server";

interface BackupFile {
  version: number;
  createdAt?: string;
  migration: string;
  nodeId: string;
  region: string;
  data: {
    properties: Array<{
      id: string; canonicalId: string; name: string; location: string;
      lat: number | null; lon: number | null; dataSource: string;
      osmId: string | null; wheelmapId: string | null;
      createdAt: string; updatedAt: string;
    }>;
    facts: Array<{
      id: string; propertyId: string; fieldName: string; value: string;
      tier: string; sourceType: string; sourceNodeId: string;
      submittedBy: string | null; signatureHash: string | null; timestamp: string;
    }>;
    audits: Array<{
      id: string; propertyId: string; auditorToken: string | null;
      facts: unknown; photoUrls: unknown; createdAt: string;
    }>;
    peers: Array<{
      id: string; url: string; publicKey: string | null;
      lastSeen: string; isActive: boolean;
    }>;
    osmSyncState: Array<{
      id: string; bbox: string; lastSync: string | null;
      itemCount: number | null; updatedAt: string;
    }>;
    nodeSettings?: {
      id: string; bbox: string | null; region: string | null;
      presetId: string | null; configuredAt: string | null;
      lastIngestAt: string | null;       lastIngestCount: number | null;
      openRegistration?: boolean;
      auditedReimportPending?: boolean;
      updatedAt: string;
    } | null;
    metadataOverrides?: Array<{
      id: string; propertyId: string; canonicalId: string; fieldName: string;
      value: string; sourceType: string; sourceNodeId: string;
      submittedBy: string | null; signatureHash: string | null;
      timestamp: string; clearedAt: string | null;
    }>;
  };
}

function formatMigrationRestoreWarning(
  backupMigration: string,
  currentMigration: string,
  createdAt?: string
): string {
  const migrationLabel = `migration "${backupMigration}"`;
  let backupWhen = `created on ${migrationLabel}`;
  if (createdAt) {
    const at = new Date(createdAt);
    if (!Number.isNaN(at.getTime())) {
      const formatted = at.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
      backupWhen = `from ${formatted} (${migrationLabel})`;
    }
  }
  return `Backup ${backupWhen}, current is "${currentMigration}". Proceeding anyway — verify data integrity after restore.`;
}

/**
 * POST /api/admin/restore
 *
 * Restores node data from a backup JSON file.
 * - Warns if the backup migration differs from the current schema.
 * - Deletes all existing data first (full replace, not merge).
 * - Restores in FK-safe order: properties → facts → audits → peers → osmSyncState.
 *
 * Protected by ADMIN_SECRET env var (Bearer token).
 */
export async function POST(req: NextRequest) {
  const authError = await requireRole(req, "ADMIN");
  if (authError) return authError;

  let backup: BackupFile;
  try {
    backup = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }

  if ((backup.version !== 1 && backup.version !== 2) || !backup.data) {
    return NextResponse.json({ message: "Unrecognised backup format (expected version 1 or 2)" }, { status: 400 });
  }

  // Check migration compatibility
  let currentMigration = "unknown";
  try {
    const result = await prisma.$queryRaw<{ migration_name: string }[]>`
      SELECT migration_name FROM "_prisma_migrations"
      WHERE finished_at IS NOT NULL
      ORDER BY finished_at DESC
      LIMIT 1
    `;
    currentMigration = result[0]?.migration_name ?? "unknown";
  } catch { /* ignore */ }

  const migrationWarning =
    backup.migration !== currentMigration && backup.migration !== "unknown"
      ? formatMigrationRestoreWarning(backup.migration, currentMigration, backup.createdAt)
      : null;

  const warnings: string[] = migrationWarning ? [migrationWarning] : [];
  console.warn("[restore] Starting restore from backup nodeId=%s migration=%s", backup.nodeId, backup.migration);
  if (migrationWarning) console.warn("[restore]", migrationWarning);

  // Wipe existing data in reverse FK order
  await prisma.$transaction([
    prisma.gossipSnapshot.deleteMany(),
    prisma.auditSubmission.deleteMany(),
    prisma.propertyMetadataOverride.deleteMany(),
    prisma.accessibilityFact.deleteMany(),
    prisma.property.deleteMany(),
    prisma.nodePeer.deleteMany(),
    prisma.osmSyncState.deleteMany(),
  ]);

  const { properties, facts, audits, peers, osmSyncState, nodeSettings, metadataOverrides } = backup.data;

  // Restore in FK-safe order
  // 1. Properties
  let propertiesRestored = 0;
  for (const p of properties ?? []) {
    try {
      await prisma.property.create({
        data: {
          id: p.id, canonicalId: p.canonicalId, name: p.name, location: p.location,
          lat: p.lat, lon: p.lon, dataSource: p.dataSource ?? "NODE_ORIGINAL",
          osmId: p.osmId, wheelmapId: p.wheelmapId,
          createdAt: new Date(p.createdAt), updatedAt: new Date(p.updatedAt),
        },
      });
      propertiesRestored++;
    } catch (err) {
      warnings.push(`Property ${p.id} skipped: ${String(err)}`);
    }
  }

  // 2. Metadata overrides (after properties)
  let metadataOverridesRestored = 0;
  for (const o of metadataOverrides ?? []) {
    try {
      await prisma.propertyMetadataOverride.create({
        data: {
          id: o.id,
          propertyId: o.propertyId,
          canonicalId: o.canonicalId,
          fieldName: o.fieldName,
          value: o.value,
          sourceType: o.sourceType as never,
          sourceNodeId: o.sourceNodeId,
          submittedBy: o.submittedBy,
          signatureHash: o.signatureHash,
          timestamp: new Date(o.timestamp),
          clearedAt: o.clearedAt ? new Date(o.clearedAt) : null,
        },
      });
      metadataOverridesRestored++;
    } catch (err) {
      warnings.push(`Metadata override ${o.id} skipped: ${String(err)}`);
    }
  }

  // 3. Facts
  let factsRestored = 0;
  for (const f of facts ?? []) {
    try {
      await prisma.accessibilityFact.create({
        data: {
          id: f.id, propertyId: f.propertyId, fieldName: f.fieldName, value: f.value,
          tier: f.tier as never, sourceType: f.sourceType as never,
          sourceNodeId: f.sourceNodeId, submittedBy: f.submittedBy,
          signatureHash: f.signatureHash, timestamp: new Date(f.timestamp),
        },
      });
      factsRestored++;
    } catch (err) {
      warnings.push(`Fact ${f.id} skipped: ${String(err)}`);
    }
  }

  // 4. Audits
  let auditsRestored = 0;
  for (const a of audits ?? []) {
    try {
      await prisma.auditSubmission.create({
        data: {
          id: a.id, propertyId: a.propertyId, auditorToken: a.auditorToken,
          facts: a.facts as never, photoUrls: a.photoUrls as never,
          createdAt: new Date(a.createdAt),
        },
      });
      auditsRestored++;
    } catch (err) {
      warnings.push(`Audit ${a.id} skipped: ${String(err)}`);
    }
  }

  // 5. Peers
  let peersRestored = 0;
  for (const peer of peers ?? []) {
    try {
      await prisma.nodePeer.create({
        data: {
          id: peer.id, url: peer.url, publicKey: peer.publicKey,
          lastSeen: new Date(peer.lastSeen), isActive: peer.isActive,
        },
      });
      peersRestored++;
    } catch (err) {
      warnings.push(`Peer ${peer.url} skipped: ${String(err)}`);
    }
  }

  // 6. OSM sync state
  for (const s of osmSyncState ?? []) {
    try {
      await prisma.osmSyncState.create({
        data: {
          id: s.id, bbox: s.bbox,
          lastSync: s.lastSync ? new Date(s.lastSync) : null,
          itemCount: s.itemCount, updatedAt: new Date(s.updatedAt),
        },
      });
    } catch { /* non-critical, skip */ }
  }

  if (nodeSettings) {
    try {
      await prisma.nodeSettings.upsert({
        where: { id: "default" },
        update: {
          bbox: nodeSettings.bbox,
          region: nodeSettings.region,
          presetId: nodeSettings.presetId,
          configuredAt: nodeSettings.configuredAt ? new Date(nodeSettings.configuredAt) : null,
          lastIngestAt: nodeSettings.lastIngestAt ? new Date(nodeSettings.lastIngestAt) : null,
          lastIngestCount: nodeSettings.lastIngestCount,
          openRegistration: nodeSettings.openRegistration ?? true,
          auditedReimportPending: nodeSettings.auditedReimportPending ?? false,
          updatedAt: new Date(nodeSettings.updatedAt),
        },
        create: {
          id: "default",
          bbox: nodeSettings.bbox,
          region: nodeSettings.region,
          presetId: nodeSettings.presetId,
          configuredAt: nodeSettings.configuredAt ? new Date(nodeSettings.configuredAt) : null,
          lastIngestAt: nodeSettings.lastIngestAt ? new Date(nodeSettings.lastIngestAt) : null,
          lastIngestCount: nodeSettings.lastIngestCount,
          openRegistration: nodeSettings.openRegistration ?? true,
          auditedReimportPending: nodeSettings.auditedReimportPending ?? false,
          updatedAt: new Date(nodeSettings.updatedAt),
        },
      });
    } catch { /* non-critical */ }
  }

  console.log(
    "[restore] Done: %d properties, %d metadata overrides, %d facts, %d audits, %d peers",
    propertiesRestored, metadataOverridesRestored, factsRestored, auditsRestored, peersRestored
  );

  return NextResponse.json({
    ok: true,
    restored: {
      properties: propertiesRestored,
      metadataOverrides: metadataOverridesRestored,
      facts: factsRestored,
      audits: auditsRestored,
      peers: peersRestored,
    },
    warnings,
  });
}


