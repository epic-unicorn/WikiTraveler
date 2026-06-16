/**
 * Upsert properties from a gossip delta and map remote property UUIDs → local IDs.
 * Each node generates its own property IDs during seed; facts must be remapped by canonicalId.
 */

import type { GossipDelta } from "@wikitraveler/core";
import { prisma } from "@/lib/prisma";

type GossipProperty = GossipDelta["properties"][number];

export async function upsertGossipProperties(
  properties: GossipProperty[]
): Promise<Map<string, string>> {
  const idMap = new Map<string, string>();
  if (properties.length === 0) return idMap;

  await Promise.all(
    properties.map((p) =>
      prisma.property.upsert({
        where: { canonicalId: p.canonicalId },
        update: {
          name: p.name,
          location: p.location,
          osmId: p.osmId ?? undefined,
          wheelmapId: p.wheelmapId ?? undefined,
          ...(p.lat != null && p.lon != null ? { lat: p.lat, lon: p.lon } : {}),
        },
        create: {
          canonicalId: p.canonicalId,
          name: p.name,
          location: p.location,
          lat: p.lat ?? null,
          lon: p.lon ?? null,
          osmId: p.osmId ?? null,
          wheelmapId: p.wheelmapId ?? null,
        },
      })
    )
  );

  const locals = await prisma.property.findMany({
    where: { canonicalId: { in: properties.map((p) => p.canonicalId) } },
    select: { id: true, canonicalId: true },
  });
  const byCanonical = new Map(locals.map((l) => [l.canonicalId, l.id]));
  for (const p of properties) {
    const localId = byCanonical.get(p.canonicalId);
    if (localId) idMap.set(p.id, localId);
  }
  return idMap;
}

export function remapFactsPropertyIds<T extends { propertyId: string }>(
  facts: T[],
  idMap: Map<string, string>
): T[] {
  return facts.map((f) => ({
    ...f,
    propertyId: idMap.get(f.propertyId) ?? f.propertyId,
  }));
}
