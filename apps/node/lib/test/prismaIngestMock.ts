import { vi } from "vitest";
import type { PrismaClient } from "@prisma/client";

export interface MockProperty {
  id: string;
  canonicalId: string;
  name: string;
  location: string;
  lat: number | null;
  lon: number | null;
  osmId: string | null;
  dataSource: string;
}

/** In-memory Prisma subset for ingestOverpassResult / import tests. */
export function createIngestPrismaMock() {
  const properties: MockProperty[] = [];
  const facts: Array<Record<string, unknown>> = [];

  const prisma = {
    property: {
      findMany: vi.fn(async () =>
        properties.map((p) => ({
          id: p.id,
          name: p.name,
          osmId: p.osmId,
          lat: p.lat,
          lon: p.lon,
        }))
      ),
      create: vi.fn(async ({ data }: { data: Omit<MockProperty, "id"> & { id?: string } }) => {
        const row: MockProperty = {
          id: data.id ?? `prop-${properties.length + 1}`,
          canonicalId: data.canonicalId,
          name: data.name,
          location: data.location,
          lat: data.lat ?? null,
          lon: data.lon ?? null,
          osmId: data.osmId ?? null,
          dataSource: data.dataSource ?? "IMPORTED_OSM",
        };
        properties.push(row);
        return row;
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<MockProperty> }) => {
        const row = properties.find((p) => p.id === where.id);
        if (!row) throw new Error("not found");
        Object.assign(row, data);
        return row;
      }),
      findUnique: vi.fn(async ({ where }: { where: { osmId?: string; canonicalId?: string; id?: string } }) => {
        if (where.osmId) return properties.find((p) => p.osmId === where.osmId) ?? null;
        if (where.canonicalId) return properties.find((p) => p.canonicalId === where.canonicalId) ?? null;
        if (where.id) return properties.find((p) => p.id === where.id) ?? null;
        return null;
      }),
    },
    accessibilityFact: {
      findMany: vi.fn(async () => []),
      upsert: vi.fn(async ({ create }: { create: Record<string, unknown> }) => {
        facts.push(create);
        return { id: `fact-${facts.length}`, ...create };
      }),
    },
  };

  return {
    prisma: prisma as unknown as PrismaClient,
    properties,
    facts,
  };
}
