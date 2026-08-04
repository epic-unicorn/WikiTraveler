import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { mergeGossipDelta } from "@wikitraveler/core";
import { createHash } from "crypto";
import { requireNodeAuth } from "@/lib/auth";
import { validateGossipDeltaProtocol } from "@/lib/gossipProtocol";
import { remapFactsPropertyIds, upsertGossipProperties } from "@/lib/gossipProperties";
import { isSelfPeer } from "@/lib/linkPeer";
import { getNodeBbox } from "@/lib/nodeSettings";
import { makeBboxFilterFromString } from "@/lib/regionPurge";
import {
  applyIncomingMetadataOverrides,
  filterMetadataOverridesByBbox,
} from "@/lib/propertyMetadata";
import type { GossipDelta, Tier, SourceType } from "@wikitraveler/core";


export const dynamic = "force-dynamic";
// POST /api/gossip/ingest
export async function POST(req: Request) {
  const authError = await requireNodeAuth(req as import("next/server").NextRequest);
  if (authError) return authError;
  let delta: GossipDelta;
  try {
    delta = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }

  if (!delta.fromNodeId || !Array.isArray(delta.facts)) {
    return NextResponse.json(
      { message: "Invalid delta: fromNodeId and facts[] are required" },
      { status: 400 }
    );
  }

  const protocolCheck = validateGossipDeltaProtocol(delta);
  if (!protocolCheck.ok) {
    return NextResponse.json({ message: protocolCheck.message }, { status: 400 });
  }

  const incomingOverrides = Array.isArray(delta.metadataOverrides) ? delta.metadataOverrides : [];

  // ------------------------------------------------------------------
  // 1. Upsert any properties that arrived with the delta.
  //    Filter out properties outside this node's bbox to prevent a
  //    world-node (or misconfigured peer) from bloating our database.
  // ------------------------------------------------------------------
  const nodeBbox = await getNodeBbox();
  if (!nodeBbox) {
    return NextResponse.json({
      ok: true,
      propertiesUpserted: 0,
      ingested: 0,
      message: "No region configured — gossip ingest skipped.",
    });
  }
  const bboxFilter = makeBboxFilterFromString(nodeBbox)!;

  const allowedProperties = Array.isArray(delta.properties)
    ? delta.properties.filter((p) => bboxFilter(p.lat, p.lon))
    : [];

  const allowedPropertyIds = new Set(allowedProperties.map((p) => p.id));

  // Also filter facts to only those belonging to allowed properties
  let allowedFacts = delta.facts.filter((f) => allowedPropertyIds.has(f.propertyId));

  if (allowedProperties.length < (delta.properties?.length ?? 0)) {
    const skipped = (delta.properties?.length ?? 0) - allowedProperties.length;
    console.info(`[ingest] Skipped ${skipped} out-of-bbox properties from ${delta.fromNodeId}`);
  }

  if (allowedProperties.length > 0) {
    const idMap = await upsertGossipProperties(allowedProperties);
    allowedFacts = remapFactsPropertyIds(allowedFacts, idMap);
  }

  let metadataOverridesApplied = 0;
  if (incomingOverrides.length > 0) {
    const allowedOverrides = await filterMetadataOverridesByBbox(incomingOverrides, bboxFilter);
    if (allowedOverrides.length < incomingOverrides.length) {
      console.info(
        `[ingest] Skipped ${incomingOverrides.length - allowedOverrides.length} out-of-bbox metadata overrides from ${delta.fromNodeId}`
      );
    }
    metadataOverridesApplied = await applyIncomingMetadataOverrides(allowedOverrides);
  }

  // Peer exchange must run even when the delta has no in-bbox facts — otherwise
  // organic discovery stalls after bootstrap until someone audits in-region.
  async function upsertRemotePeers() {
    if (!Array.isArray(delta.peers) || delta.peers.length === 0) return 0;
    const remotePeers = delta.peers.filter((peer) => !isSelfPeer(peer.url, peer.nodeId));
    await Promise.all(
      remotePeers.map((peer) =>
        prisma.nodePeer.upsert({
          where: { url: peer.url },
          update: {
            nodeId: peer.nodeId ?? undefined,
            region: peer.region ?? undefined,
            bbox: peer.bbox ?? undefined,
            ...(typeof peer.gossipProtocol === "number"
              ? { gossipProtocol: peer.gossipProtocol }
              : {}),
            ...(peer.version ? { lastKnownVersion: peer.version } : {}),
            lastSeen: new Date(),
            isActive: true,
          },
          create: {
            url: peer.url,
            nodeId: peer.nodeId,
            region: peer.region,
            bbox: peer.bbox,
            gossipProtocol: typeof peer.gossipProtocol === "number" ? peer.gossipProtocol : null,
            lastKnownVersion: peer.version ?? null,
            isActive: true,
          },
        })
      )
    );
    return remotePeers.length;
  }

  if (allowedFacts.length === 0 && metadataOverridesApplied === 0) {
    const peersUpserted = await upsertRemotePeers();
    return NextResponse.json({
      ok: true,
      propertiesUpserted: allowedProperties.length,
      ingested: 0,
      metadataOverridesApplied: 0,
      peersUpserted,
    });
  }

  if (allowedFacts.length === 0) {
    await prisma.gossipSnapshot.create({
      data: {
        fromNodeId: delta.fromNodeId,
        snapshotHash: createHash("sha256").update(JSON.stringify(incomingOverrides)).digest("hex"),
        factCount: 0,
      },
    });
  } else {
    // ------------------------------------------------------------------
    // 2. Merge and upsert facts (only for allowed properties)
    // ------------------------------------------------------------------
    const propertyIds = [...new Set(allowedFacts.map((f) => f.propertyId))];

    const existingFacts = await prisma.accessibilityFact.findMany({
      where: { propertyId: { in: propertyIds } },
    });

    const asFacts = existingFacts.map((f) => ({
      id: f.id,
      propertyId: f.propertyId,
      fieldName: f.fieldName,
      value: f.value,
      tier: f.tier as Tier,
      sourceType: f.sourceType as SourceType,
      sourceNodeId: f.sourceNodeId,
      submittedBy: f.submittedBy,
      timestamp: f.timestamp.toISOString(),
      signatureHash: f.signatureHash,
    }));

    const merged = mergeGossipDelta(asFacts, { ...delta, facts: allowedFacts });

    await Promise.all(
      merged.map((fact) =>
        prisma.accessibilityFact.upsert({
          where: {
            propertyId_fieldName_sourceNodeId_scopeKey: {
              propertyId: fact.propertyId,
              fieldName: fact.fieldName,
              sourceNodeId: fact.sourceNodeId,
              scopeKey: (fact as { scopeKey?: string }).scopeKey ?? "property",
            },
          },
          update: { value: fact.value, tier: fact.tier, timestamp: new Date(fact.timestamp) },
          create: {
            propertyId: fact.propertyId,
            fieldName: fact.fieldName,
            value: fact.value,
            tier: fact.tier,
            sourceType: fact.sourceType ?? "AUDITOR",
            sourceNodeId: fact.sourceNodeId,
            submittedBy: fact.submittedBy,
            timestamp: new Date(fact.timestamp),
            signatureHash: fact.signatureHash,
          },
        })
      )
    );

    const snapshotHash = createHash("sha256")
      .update(JSON.stringify(allowedFacts))
      .digest("hex");

    await prisma.gossipSnapshot.create({
      data: {
        fromNodeId: delta.fromNodeId,
        snapshotHash,
        factCount: allowedFacts.length,
      },
    });
  }

  const peersUpserted = await upsertRemotePeers();

  return NextResponse.json({
    ok: true,
    propertiesUpserted: allowedProperties.length,
    ingested: allowedFacts.length,
    metadataOverridesApplied,
    peersUpserted,
  });
}
