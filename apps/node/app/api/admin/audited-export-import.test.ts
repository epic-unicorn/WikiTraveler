import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const { prismaMock, requireRole, getNodeRegionLabel, setAuditedReimportPending, upsert } = vi.hoisted(() => {
  const upsert = vi.fn().mockResolvedValue({});
  return {
    upsert,
    prismaMock: {
      accessibilityFact: { findMany: vi.fn(), upsert },
      auditSubmission: { findMany: vi.fn() },
      property: { findMany: vi.fn(), findUnique: vi.fn() },
      nodeSettings: { upsert: vi.fn() },
    },
    requireRole: vi.fn(),
    getNodeRegionLabel: vi.fn(),
    setAuditedReimportPending: vi.fn(),
  };
});

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/auth", () => ({ requireRole }));
vi.mock("@/lib/nodeSettings", () => ({ getNodeRegionLabel, setAuditedReimportPending }));
vi.mock("@/lib/nodeInfo", () => ({ NODE_ID: "test-node" }));

import { GET } from "./export/audited/route";
import { POST as importPOST } from "./import/audited/route";

function adminOk() {
  requireRole.mockResolvedValue(null);
}

function adminDenied() {
  requireRole.mockResolvedValue(NextResponse.json({ message: "Forbidden" }, { status: 403 }));
}

function sampleAuditedExport() {
  const now = new Date().toISOString();
  const property = {
    id: "prop-old",
    canonicalId: "osm:61101641",
    name: "Pullman Eindhoven Cocagne",
    location: "Vestdijk 47",
    lat: 51.4386355,
    lon: 5.4821862,
    osmId: "61101641",
    dataSource: "IMPORTED_OSM",
    wheelmapId: null,
    createdAt: now,
    updatedAt: now,
  };
  const auditorFact = {
    id: "fact-auditor-1",
    propertyId: "prop-old",
    fieldName: "step_free_entrance",
    scopeKey: "property",
    value: "yes",
    tier: "VERIFIED",
    sourceType: "AUDITOR",
    sourceNodeId: "test-node",
    submittedBy: "auditor@example.com",
    signatureHash: "abc123",
    timestamp: now,
    property,
  };
  const audit = {
    id: "audit-1",
    propertyId: "prop-old",
    auditorToken: "token-1",
    locale: "en",
    facts: { step_free_entrance: "yes" },
    photoUrls: [],
    createdAt: now,
    photos: [
      {
        id: "photo-1",
        auditId: "audit-1",
        url: "https://example.com/photo.jpg",
        caption: "Entrance",
        fieldName: "step_free_entrance",
        scopeKey: "property",
        width: 800,
        height: 600,
        sortOrder: 0,
      },
    ],
  };
  return { now, property, auditorFact, audit };
}

describe("GET /api/admin/export/audited", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    adminOk();
    getNodeRegionLabel.mockResolvedValue("Eindhoven");
  });

  it("requires admin", async () => {
    adminDenied();
    const res = await GET(new NextRequest("http://localhost/api/admin/export/audited"));
    expect(res.status).toBe(403);
  });

  it("exports auditor facts, related properties, and audits", async () => {
    const { property, auditorFact, audit } = sampleAuditedExport();
    prismaMock.accessibilityFact.findMany.mockResolvedValue([auditorFact]);
    prismaMock.auditSubmission.findMany.mockResolvedValue([audit]);
    prismaMock.property.findMany.mockResolvedValue([property]);

    const res = await GET(new NextRequest("http://localhost/api/admin/export/audited"));
    expect(res.status).toBe(200);

    const body = JSON.parse(await res.text());
    expect(body.version).toBe(1);
    expect(body.type).toBe("audited");
    expect(body.nodeId).toBe("test-node");
    expect(body.region).toBe("Eindhoven");
    expect(body.properties).toHaveLength(1);
    expect(body.facts).toHaveLength(1);
    expect(body.facts[0]).not.toHaveProperty("property");
    expect(body.facts[0].sourceType).toBe("AUDITOR");
    expect(body.audits).toHaveLength(1);
    expect(body.audits[0].photos).toHaveLength(1);
    expect(res.headers.get("Content-Disposition")).toContain("wikitraveler-audited");

    expect(prismaMock.accessibilityFact.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { sourceType: "AUDITOR" } })
    );
    expect(prismaMock.auditSubmission.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { propertyId: { in: ["prop-old"] } } })
    );
  });
});

describe("POST /api/admin/import/audited", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    adminOk();
    upsert.mockResolvedValue({});
    setAuditedReimportPending.mockResolvedValue(undefined);
  });

  it("requires admin", async () => {
    adminDenied();
    const res = await importPOST(
      new NextRequest("http://localhost/api/admin/import/audited", {
        method: "POST",
        body: JSON.stringify({ facts: [] }),
      })
    );
    expect(res.status).toBe(403);
  });

  it("rejects invalid JSON", async () => {
    const res = await importPOST(
      new NextRequest("http://localhost/api/admin/import/audited", {
        method: "POST",
        body: "not-json",
      })
    );
    expect(res.status).toBe(400);
  });

  it("rejects missing facts array", async () => {
    const res = await importPOST(
      new NextRequest("http://localhost/api/admin/import/audited", {
        method: "POST",
        body: JSON.stringify({ properties: [] }),
      })
    );
    expect(res.status).toBe(400);
  });

  it("matches properties by osmId and imports auditor facts", async () => {
    const { property, auditorFact } = sampleAuditedExport();
    const newProperty = { ...property, id: "prop-new-after-ingest" };

    prismaMock.property.findUnique.mockImplementation(async ({ where }: { where: Record<string, string> }) => {
      if (where.osmId === property.osmId) return newProperty;
      if (where.canonicalId === property.canonicalId) return newProperty;
      return null;
    });

    const res = await importPOST(
      new NextRequest("http://localhost/api/admin/import/audited", {
        method: "POST",
        body: JSON.stringify({
          version: 1,
          type: "audited",
          properties: [property],
          facts: [auditorFact],
        }),
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.matched).toBe(1);
    expect(body.skipped).toBe(0);
    expect(body.factsImported).toBe(1);

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          propertyId_fieldName_sourceNodeId_scopeKey: {
            propertyId: "prop-new-after-ingest",
            fieldName: "step_free_entrance",
            sourceNodeId: "test-node",
            scopeKey: "property",
          },
        },
        create: expect.objectContaining({
          propertyId: "prop-new-after-ingest",
          sourceType: "AUDITOR",
          tier: "VERIFIED",
        }),
      })
    );
    expect(setAuditedReimportPending).toHaveBeenCalledWith(false);
  });

  it("skips non-auditor facts and unmatched properties", async () => {
    const { property } = sampleAuditedExport();
    prismaMock.property.findUnique.mockResolvedValue(null);

    const res = await importPOST(
      new NextRequest("http://localhost/api/admin/import/audited", {
        method: "POST",
        body: JSON.stringify({
          properties: [property],
          facts: [
            {
              propertyId: property.id,
              fieldName: "step_free_entrance",
              value: "yes",
              tier: "OFFICIAL",
              sourceType: "OSM",
              sourceNodeId: "test-node:osm",
            },
            {
              propertyId: property.id,
              fieldName: "elevator",
              value: "yes",
              tier: "VERIFIED",
              sourceType: "AUDITOR",
              sourceNodeId: "test-node",
            },
          ],
        }),
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.matched).toBe(0);
    expect(body.skipped).toBe(1);
    expect(body.factsImported).toBe(0);
    expect(upsert).not.toHaveBeenCalled();
    expect(setAuditedReimportPending).toHaveBeenCalledWith(false);
  });

  it("round-trip: export payload can be re-imported after property ids change", async () => {
    const { property, auditorFact, audit } = sampleAuditedExport();
    prismaMock.accessibilityFact.findMany.mockResolvedValue([auditorFact]);
    prismaMock.auditSubmission.findMany.mockResolvedValue([audit]);
    prismaMock.property.findMany.mockResolvedValue([property]);

    const exportRes = await GET(new NextRequest("http://localhost/api/admin/export/audited"));
    const exported = JSON.parse(await exportRes.text());

    const newProperty = { ...property, id: "prop-new-after-ingest" };
    prismaMock.property.findUnique.mockImplementation(async ({ where }: { where: Record<string, string> }) => {
      if (where.osmId === property.osmId) return newProperty;
      return null;
    });

    const importRes = await importPOST(
      new NextRequest("http://localhost/api/admin/import/audited", {
        method: "POST",
        body: JSON.stringify(exported),
      })
    );

    expect(importRes.status).toBe(200);
    const body = await importRes.json();
    expect(body.matched).toBe(1);
    expect(body.factsImported).toBe(1);
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ propertyId: "prop-new-after-ingest" }),
      })
    );
  });
});
