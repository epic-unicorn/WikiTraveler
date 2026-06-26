/**
 * Upsert properties from a gossip delta and map remote property UUIDs → local IDs.
 * Each node generates its own property IDs during seed; facts must be remapped by canonicalId.
 *
 * Base metadata from peers is conservative: existing rows are not overwritten except
 * for missing osmId/wheelmapId/coordinates. Manual metadata travels as overrides.
 */

import type { GossipDelta } from "@wikitraveler/core";
import { prisma } from "@/lib/prisma";

type GossipProperty = GossipDelta["properties"][number];

export async function upsertGossipProperties(
  properties: GossipProperty[]
): Promise<Map<string, string>> {
  const idMap = new Map<string, string>();
  if (properties.length === 0) return idMap;

  const canonicalIds = properties.map((p) => p.canonicalId);
  const existingRows = await prisma.property.findMany({
    where: { canonicalId: { in: canonicalIds } },
    select: {
      id: true,
      canonicalId: true,
      name: true,
      location: true,
      lat: true,
      lon: true,
      osmId: true,
      wheelmapId: true,
    },
  });
  const existingByCanonical = new Map(existingRows.map((r) => [r.canonicalId, r]));

  await Promise.all(
    properties.map(async (p) => {
      const existing = existingByCanonical.get(p.canonicalId);
      if (!existing) {
        await prisma.property.create({
          data: {
            canonicalId: p.canonicalId,
            name: p.name,
            location: p.location,
            lat: p.lat ?? null,
            lon: p.lon ?? null,
            osmId: p.osmId ?? null,
            wheelmapId: p.wheelmapId ?? null,
          },
        });
        return;
      }

      const update: {
        osmId?: string;
        wheelmapId?: string;
        lat?: number;
        lon?: number;
      } = {};

      if (!existing.osmId && p.osmId) update.osmId = p.osmId;
      if (!existing.wheelmapId && p.wheelmapId) update.wheelmapId = p.wheelmapId;
      if (existing.lat == null && p.lat != null) update.lat = p.lat;
      if (existing.lon == null && p.lon != null) update.lon = p.lon;

      if (Object.keys(update).length > 0) {
        await prisma.property.update({
          where: { id: existing.id },
          data: update,
        });
      }
    })
  );

  const locals = await prisma.property.findMany({
    where: { canonicalId: { in: canonicalIds } },
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
