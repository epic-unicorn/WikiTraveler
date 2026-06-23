import type { PrismaClient } from "@prisma/client";
import { containsPoint, parseBbox, type Bbox } from "@/lib/bbox";
import { NODE_ID } from "@/lib/nodeInfo";

/**
 * Remove properties outside the new bbox and their dependent data.
 * Keeps properties inside bbox (Option C overlap retention).
 */
export async function purgeOutsideBbox(prisma: PrismaClient, bbox: Bbox): Promise<number> {
  const properties = await prisma.property.findMany({
    select: { id: true, lat: true, lon: true },
  });

  const outsideIds = properties
    .filter((p) => !containsPoint(bbox, p.lat, p.lon))
    .map((p) => p.id);

  if (outsideIds.length === 0) return 0;

  await prisma.property.deleteMany({ where: { id: { in: outsideIds } } });
  return outsideIds.length;
}

/**
 * Purge gossip-sourced facts on properties outside bbox and remove
 * non-local facts that reference out-of-bbox properties.
 */
export async function purgeGossipOutsideBbox(prisma: PrismaClient, bbox: Bbox): Promise<number> {
  const properties = await prisma.property.findMany({
    select: { id: true, lat: true, lon: true },
  });

  const outsideIds = properties
    .filter((p) => !containsPoint(bbox, p.lat, p.lon))
    .map((p) => p.id);

  if (outsideIds.length === 0) return 0;

  const result = await prisma.accessibilityFact.deleteMany({
    where: {
      propertyId: { in: outsideIds },
      sourceNodeId: { not: NODE_ID },
    },
  });

  return result.count;
}

export async function countPropertiesOutsideBbox(
  prisma: PrismaClient,
  bbox: Bbox
): Promise<number> {
  const properties = await prisma.property.findMany({
    select: { lat: true, lon: true },
  });
  return properties.filter((p) => !containsPoint(bbox, p.lat, p.lon)).length;
}

export async function countPropertiesInsideBbox(
  prisma: PrismaClient,
  bbox: Bbox
): Promise<number> {
  const properties = await prisma.property.findMany({
    select: { lat: true, lon: true },
  });
  return properties.filter((p) => containsPoint(bbox, p.lat, p.lon)).length;
}

export function makeBboxFilterFromString(raw: string | null) {
  const bbox = parseBbox(raw);
  if (!bbox) return null;
  return (lat: number | null | undefined, lon: number | null | undefined) => {
    if (lat == null || lon == null) return true;
    return containsPoint(bbox, lat, lon);
  };
}
