import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const { prismaMock, requireRole, getNodeRegionLabel, create, deleteMany } = vi.hoisted(() => {
  const deleteMany = vi.fn().mockResolvedValue({ count: 0 });
  const create = vi.fn().mockResolvedValue({});
  return {
    deleteMany,
    create,
    prismaMock: {
      property: { findMany: vi.fn(), create, deleteMany },
      accessibilityFact: { findMany: vi.fn(), create, deleteMany },
      auditSubmission: { findMany: vi.fn(), create, deleteMany },
      nodePeer: { findMany: vi.fn(), create, deleteMany },
      osmSyncState: { findMany: vi.fn(), create, deleteMany },
      nodeSettings: { findUnique: vi.fn(), upsert: vi.fn() },
      gossipSnapshot: { deleteMany },
      $queryRaw: vi.fn(),
      $transaction: vi.fn(),
    },
    requireRole: vi.fn(),
    getNodeRegionLabel: vi.fn(),
  };
});

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/auth", () => ({ requireRole }));
vi.mock("@/lib/nodeSettings", () => ({ getNodeRegionLabel }));
vi.mock("@/lib/nodeInfo", () => ({ NODE_ID: "test-node" }));

import { GET } from "./backup/route";
import { POST as restorePOST } from "./restore/route";

function adminOk() {
  requireRole.mockResolvedValue(null);
}

function adminDenied() {
  requireRole.mockResolvedValue(NextResponse.json({ message: "Forbidden" }, { status: 403 }));
}

function sampleBackupData() {
  const now = new Date().toISOString();
  return {
    version: 1,
    createdAt: now,
    migration: "20260423123302_init",
    nodeId: "test-node",
    region: "Eindhoven",
    data: {
      properties: [
        {
          id: "prop-1",
          canonicalId: "osm:61101641",
          name: "Pullman Eindhoven Cocagne",
          location: "Vestdijk 47",
          lat: 51.4386355,
          lon: 5.4821862,
          dataSource: "IMPORTED_OSM",
          osmId: "61101641",
          wheelmapId: null,
          createdAt: now,
          updatedAt: now,
        },
      ],
      facts: [
        {
          id: "fact-1",
          propertyId: "prop-1",
          fieldName: "step_free_entrance",
          value: "yes",
          tier: "OFFICIAL",
          sourceType: "OSM",
          sourceNodeId: "test-node:osm",
          submittedBy: "osm-ingest",
          signatureHash: null,
          timestamp: now,
        },
      ],
      audits: [],
      peers: [
        {
          id: "peer-1",
          url: "https://peer.example.com",
          publicKey: null,
          lastSeen: now,
          isActive: true,
        },
      ],
      osmSyncState: [
        {
          id: "sync-1",
          bbox: "51.39,5.42,51.49,5.52",
          lastSync: now,
          itemCount: 2,
          updatedAt: now,
        },
      ],
      nodeSettings: {
        id: "default",
        bbox: "51.39,5.42,51.49,5.52",
        region: "Eindhoven",
        presetId: "eindhoven",
        configuredAt: now,
        lastIngestAt: now,
        lastIngestCount: 2,
        openRegistration: true,
        auditedReimportPending: false,
        updatedAt: now,
      },
    },
  };
}

describe("GET /api/admin/backup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    adminOk();
    getNodeRegionLabel.mockResolvedValue("Eindhoven");
    prismaMock.$queryRaw.mockResolvedValue([{ migration_name: "20260423123302_init" }]);
  });

  it("requires admin", async () => {
    adminDenied();
    const res = await GET(new NextRequest("http://localhost/api/admin/backup"));
    expect(res.status).toBe(403);
  });

  it("returns version 1 backup with all data sections", async () => {
    const sample = sampleBackupData();
    prismaMock.property.findMany.mockResolvedValue(sample.data.properties);
    prismaMock.accessibilityFact.findMany.mockResolvedValue(sample.data.facts);
    prismaMock.auditSubmission.findMany.mockResolvedValue(sample.data.audits);
    prismaMock.nodePeer.findMany.mockResolvedValue(sample.data.peers);
    prismaMock.osmSyncState.findMany.mockResolvedValue(sample.data.osmSyncState);
    prismaMock.nodeSettings.findUnique.mockResolvedValue(sample.data.nodeSettings);

    const res = await GET(new NextRequest("http://localhost/api/admin/backup"));
    expect(res.status).toBe(200);

    const body = JSON.parse(await res.text());
    expect(body.version).toBe(1);
    expect(body.nodeId).toBe("test-node");
    expect(body.data.properties).toHaveLength(1);
    expect(body.data.facts).toHaveLength(1);
    expect(body.data.peers).toHaveLength(1);
    expect(body.data.nodeSettings?.bbox).toBe("51.39,5.42,51.49,5.52");
    expect(res.headers.get("Content-Disposition")).toContain("wikitraveler-backup");
  });
});

describe("POST /api/admin/restore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    adminOk();
    prismaMock.$queryRaw.mockResolvedValue([{ migration_name: "20260423123302_init" }]);
    prismaMock.$transaction.mockImplementation(async (ops: unknown[]) => {
      for (const op of ops) await op;
    });
    create.mockResolvedValue({});
    prismaMock.nodeSettings.upsert.mockResolvedValue({});
  });

  it("rejects invalid backup format", async () => {
    const req = new NextRequest("http://localhost/api/admin/restore", {
      method: "POST",
      body: JSON.stringify({ version: 2 }),
    });
    const res = await restorePOST(req);
    expect(res.status).toBe(400);
  });

  it("wipes existing data and restores from backup", async () => {
    const backup = sampleBackupData();
    const req = new NextRequest("http://localhost/api/admin/restore", {
      method: "POST",
      body: JSON.stringify(backup),
    });

    const res = await restorePOST(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.restored).toEqual({
      properties: 1,
      facts: 1,
      audits: 0,
      peers: 1,
    });

    expect(prismaMock.$transaction).toHaveBeenCalled();
    expect(deleteMany).toHaveBeenCalled();
    expect(create).toHaveBeenCalled();
    expect(prismaMock.nodeSettings.upsert).toHaveBeenCalled();
  });

  it("warns when backup migration differs from current schema", async () => {
    prismaMock.$queryRaw.mockResolvedValue([
      { migration_name: "20260623150000_audited_reimport_pending" },
    ]);
    const backup = {
      ...sampleBackupData(),
      createdAt: "2026-06-23T14:30:00.000Z",
      migration: "20260623120000_fact_i18n_translation",
    };
    const req = new NextRequest("http://localhost/api/admin/restore", {
      method: "POST",
      body: JSON.stringify(backup),
    });

    const res = await restorePOST(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.warnings).toHaveLength(1);
    expect(body.warnings[0]).toContain("20260623120000_fact_i18n_translation");
    expect(body.warnings[0]).toContain("20260623150000_audited_reimport_pending");
    expect(body.warnings[0]).toContain("23 Jun 2026");
  });

  it("round-trip: backup payload matches restore expectations", async () => {
    const backup = sampleBackupData();
    prismaMock.property.findMany.mockResolvedValue(backup.data.properties);
    prismaMock.accessibilityFact.findMany.mockResolvedValue(backup.data.facts);
    prismaMock.auditSubmission.findMany.mockResolvedValue(backup.data.audits);
    prismaMock.nodePeer.findMany.mockResolvedValue(backup.data.peers);
    prismaMock.osmSyncState.findMany.mockResolvedValue(backup.data.osmSyncState);
    prismaMock.nodeSettings.findUnique.mockResolvedValue(backup.data.nodeSettings);

    const getRes = await GET(new NextRequest("http://localhost/api/admin/backup"));
    const exported = JSON.parse(await getRes.text());

    const restoreReq = new NextRequest("http://localhost/api/admin/restore", {
      method: "POST",
      body: JSON.stringify(exported),
    });
    const restoreRes = await restorePOST(restoreReq);
    expect(restoreRes.status).toBe(200);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ id: "prop-1", name: "Pullman Eindhoven Cocagne" }),
      })
    );
  });
});
