import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { mergeGossipDelta } from "@wikitraveler/core";
import {
  parseSignatureHeader,
  verifyBody,
  fetchPeerPublicKey,
} from "@/lib/httpSignature";
import type { GossipDelta, Tier, SourceType } from "@wikitraveler/core";

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

  // Resolve sender's public key — check cache first, then fetch live
  let publicKey: string | null = null;
  const cachedPeer = await prisma.nodePeer.findUnique({
    where: { url: parsedSig.keyId },
  });
  if (cachedPeer?.publicKey) {
    publicKey = cachedPeer.publicKey;
  } else {
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

  // Signature verified — parse and process the payload
  let payload: GossipDelta & { fromNodeUrl?: string };
  try {
    payload = JSON.parse(rawBody) as GossipDelta & { fromNodeUrl?: string };
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }

  if (!payload.fromNodeId || !Array.isArray(payload.facts) || payload.facts.length === 0) {
    return NextResponse.json(
      { message: "fromNodeId and facts[] are required" },
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

  // Step 1: Upsert any properties that arrived with the push (FK safety)
  let propertiesUpserted = 0;
  if (Array.isArray(payload.properties) && payload.properties.length > 0) {
    await Promise.all(
      payload.properties.map((p) =>
        prisma.property.upsert({
          where: { amadeusId: p.amadeusId },
          update: { name: p.name, location: p.location },
          create: {
            id: p.id,
            amadeusId: p.amadeusId,
            name: p.name,
            location: p.location,
            osmId: p.osmId ?? null,
            wheelmapId: p.wheelmapId ?? null,
          },
        })
      )
    );
    propertiesUpserted = payload.properties.length;
  }

  // Step 2: Merge incoming facts with existing using core merge logic
  const propertyIds = [...new Set(payload.facts.map((f) => f.propertyId))];
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

  const merged = mergeGossipDelta(existingFacts, payload);

  await Promise.all(
    merged.map((fact) =>
      prisma.accessibilityFact.upsert({
        where: {
          propertyId_fieldName_sourceNodeId: {
            propertyId: fact.propertyId,
            fieldName: fact.fieldName,
            sourceNodeId: fact.sourceNodeId,
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

  return NextResponse.json({ propertiesUpserted, ingested: merged.length });
}
