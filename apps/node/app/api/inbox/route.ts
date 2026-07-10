import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { mergeGossipDelta } from "@wikitraveler/core";
import {
  parseSignatureHeader,
  verifyBody,
  fetchPeerPublicKey,
} from "@/lib/httpSignature";
import { remapFactsPropertyIds, upsertGossipProperties } from "@/lib/gossipProperties";
import { getNodeBbox } from "@/lib/nodeSettings";
import { makeBboxFilterFromString } from "@/lib/regionPurge";
import {
  applyIncomingMetadataOverrides,
  filterMetadataOverridesByBbox,
} from "@/lib/propertyMetadata";
import { validateGossipDeltaProtocol } from "@/lib/gossipProtocol";
import type { GossipDelta, Tier, SourceType } from "@wikitraveler/core";


export { dynamic } from "@/lib/apiRoute";
/**
 * POST /api/inbox
 *
 * ActivityPub-inspired real-time push endpoint. A peer node calls this after
 * it saves a new VERIFIED fact, pushing the fact immediately rather than
 * waiting for the next gossip cron cycle.
 *
 * Security:
 *   - The request body must be signed with the sender's RSA private key.
 *   - The receiver looks up the sender's public key (cached in NodePeer or
 *     fetched live from the sender's /api/nodeinfo) and verifies the signature
 *     before accepting any data.
 *
 * Payload shape matches GossipDelta + an optional fromNodeUrl field:
 *   { fromNodeId, fromNodeUrl?, facts[], properties?[] }
 */
export async function POST(req: NextRequest) {
  // Read raw body for signature verification BEFORE parsing JSON
  const rawBody = await req.text();

  const sigHeader = req.headers.get("x-wikitraveler-signature");
  if (!sigHeader) {
    return NextResponse.json(
      { message: "Missing X-WikiTraveler-Signature header" },
      { status: 401 }
    );
  }

  const parsedSig = parseSignatureHeader(sigHeader);
  if (!parsedSig) {
    return NextResponse.json(
      { message: "Malformed signature header" },
      { status: 401 }
    );
  }

  // Resolve sender's public key — peer table first (docker URLs), then signature keyId
  let publicKey: string | null = null;
  let payload: GossipDelta & { fromNodeUrl?: string };
  try {
    payload = JSON.parse(rawBody) as GossipDelta & { fromNodeUrl?: string };
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }

  const peerByNodeId = payload.fromNodeId
    ? await prisma.nodePeer.findFirst({ where: { nodeId: payload.fromNodeId, isActive: true } })
    : null;
  if (peerByNodeId?.publicKey) {
    publicKey = peerByNodeId.publicKey;
  }

  const cachedPeer = await prisma.nodePeer.findUnique({
    where: { url: parsedSig.keyId },
  });
  if (!publicKey && cachedPeer?.publicKey) {
    publicKey = cachedPeer.publicKey;
  }

  if (!publicKey && peerByNodeId?.url) {
    publicKey = await fetchPeerPublicKey(peerByNodeId.url);
    if (publicKey) {
      await prisma.nodePeer.update({
        where: { id: peerByNodeId.id },
        data: { publicKey, lastSeen: new Date() },
      });
    }
  }

  if (!publicKey) {
    publicKey = await fetchPeerPublicKey(parsedSig.keyId);
    if (publicKey) {
      await prisma.nodePeer.upsert({
        where: { url: parsedSig.keyId },
        update: { publicKey, lastSeen: new Date(), isActive: true },
        create: { url: parsedSig.keyId, publicKey, isActive: true },
      });
    }
  }

  if (!publicKey) {
    return NextResponse.json(
      { message: "Could not resolve public key for sender" },
      { status: 401 }
    );
  }

  if (!verifyBody(rawBody, parsedSig.signature, publicKey)) {
    return NextResponse.json(
      { message: "Signature verification failed" },
      { status: 401 }
    );
  }

  // Signature verified — process the payload (already parsed above)
  const protocolCheck = validateGossipDeltaProtocol(payload);
  if (!protocolCheck.ok) {
    return NextResponse.json({ message: protocolCheck.message }, { status: 400 });
  }

  const incomingOverrides = Array.isArray(payload.metadataOverrides) ? payload.metadataOverrides : [];
  if (
    !payload.fromNodeId ||
    ((!Array.isArray(payload.facts) || payload.facts.length === 0) && incomingOverrides.length === 0)
  ) {
    return NextResponse.json(
      { message: "fromNodeId and facts[] or metadataOverrides[] are required" },
      { status: 400 }
    );
  }

  // Update peer's lastSeen so it stays active
  if (payload.fromNodeUrl) {
    await prisma.nodePeer.upsert({
      where: { url: payload.fromNodeUrl },
      update: { lastSeen: new Date(), isActive: true },
      create: { url: payload.fromNodeUrl, publicKey, isActive: true },
    });
  }

  // Step 1: Upsert properties (bbox-filtered) and remap fact propertyIds to local UUIDs
  let propertiesUpserted = 0;
  let facts = payload.facts ?? [];
  let metadataOverridesApplied = 0;

  const nodeBbox = await getNodeBbox();
  const bboxFilter = nodeBbox ? makeBboxFilterFromString(nodeBbox) : null;

  if (incomingOverrides.length > 0 && bboxFilter) {
    const allowedOverrides = await filterMetadataOverridesByBbox(incomingOverrides, bboxFilter);
    metadataOverridesApplied = await applyIncomingMetadataOverrides(allowedOverrides);
  } else if (incomingOverrides.length > 0) {
    metadataOverridesApplied = await applyIncomingMetadataOverrides(incomingOverrides);
  }

  if (facts.length === 0) {
    return NextResponse.json({ propertiesUpserted, ingested: 0, metadataOverridesApplied });
  }

  if (Array.isArray(payload.properties) && payload.properties.length > 0) {
    const allowedProperties = bboxFilter
      ? payload.properties.filter((p) => bboxFilter(p.lat ?? null, p.lon ?? null))
      : payload.properties;

    if (allowedProperties.length < payload.properties.length) {
      console.info(
        `[inbox] Skipped ${payload.properties.length - allowedProperties.length} out-of-bbox properties from ${payload.fromNodeId}`
      );
    }

    if (allowedProperties.length > 0) {
      const idMap = await upsertGossipProperties(allowedProperties);
      const allowedIds = new Set(allowedProperties.map((p) => p.id));
      facts = remapFactsPropertyIds(
        payload.facts.filter((f) => allowedIds.has(f.propertyId)),
        idMap
      );
      propertiesUpserted = allowedProperties.length;
    } else {
      facts = [];
    }
  }

  // Step 2: Merge incoming facts with existing using core merge logic
  const propertyIds = [...new Set(facts.map((f) => f.propertyId))];
  const existingRaw = await prisma.accessibilityFact.findMany({
    where: { propertyId: { in: propertyIds } },
  });

  const existingFacts = existingRaw.map((f) => ({
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

  const merged = mergeGossipDelta(existingFacts, { ...payload, facts });

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
        update: {
          value: fact.value,
          tier: fact.tier,
          timestamp: new Date(fact.timestamp),
          signatureHash: fact.signatureHash,
        },
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

  return NextResponse.json({ propertiesUpserted, ingested: merged.length, metadataOverridesApplied });
}
