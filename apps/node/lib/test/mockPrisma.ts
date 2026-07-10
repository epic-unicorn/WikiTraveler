import { vi } from "vitest";

/** Prisma model delegate names (camelCase) from schema.prisma */
const MODELS = [
  "property",
  "propertyMetadataOverride",
  "accessibilityFact",
  "factTranslation",
  "fieldDefinition",
  "auditSubmission",
  "auditPhoto",
  "osmSyncState",
  "nodeSettings",
  "ingestJob",
  "ingestJobTile",
  "communitySignal",
  "user",
  "nodePeer",
  "gossipSnapshot",
] as const;

function createModelMock() {
  return {
    findMany: vi.fn().mockResolvedValue([]),
    findFirst: vi.fn().mockResolvedValue(null),
    findUnique: vi.fn().mockResolvedValue(null),
    count: vi.fn().mockResolvedValue(0),
    create: vi.fn().mockResolvedValue({ id: "mock-id" }),
    createMany: vi.fn().mockResolvedValue({ count: 0 }),
    upsert: vi.fn().mockResolvedValue({ id: "mock-id" }),
    update: vi.fn().mockResolvedValue({ id: "mock-id" }),
    updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    delete: vi.fn().mockResolvedValue({ id: "mock-id" }),
    deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    aggregate: vi.fn().mockResolvedValue({ _count: { _all: 0 }, _avg: {}, _sum: {}, _min: {}, _max: {} }),
    groupBy: vi.fn().mockResolvedValue([]),
  };
}

export type MockPrisma = ReturnType<typeof createMockPrisma>;

/** In-memory Prisma stand-in for route handler tests (no DATABASE_URL required). */
export function createMockPrisma() {
  const prisma: Record<string, unknown> = {
    $connect: vi.fn().mockResolvedValue(undefined),
    $disconnect: vi.fn().mockResolvedValue(undefined),
    $queryRaw: vi.fn().mockResolvedValue([]),
    $executeRaw: vi.fn().mockResolvedValue(0),
    $transaction: vi.fn((arg: unknown) => {
      if (typeof arg === "function") return (arg as (tx: typeof prisma) => unknown)(prisma);
      return Promise.all(arg as Promise<unknown>[]);
    }),
  };

  for (const model of MODELS) {
    prisma[model] = createModelMock();
  }

  return prisma as MockPrisma & Record<string, ReturnType<typeof createModelMock>>;
}

/** Re-apply default resolved values (vitest restoreMocks clears them between tests). */
export function resetMockPrisma(prisma: MockPrisma) {
  for (const model of MODELS) {
    const delegate = prisma[model as keyof MockPrisma] as ReturnType<typeof createModelMock>;
    delegate.findMany.mockResolvedValue([]);
    delegate.findFirst.mockResolvedValue(null);
    delegate.findUnique.mockResolvedValue(null);
    delegate.count.mockResolvedValue(0);
    delegate.create.mockResolvedValue({ id: "mock-id" });
    delegate.createMany.mockResolvedValue({ count: 0 });
    delegate.upsert.mockResolvedValue({ id: "mock-id" });
    delegate.update.mockResolvedValue({ id: "mock-id" });
    delegate.updateMany.mockResolvedValue({ count: 0 });
    delegate.delete.mockResolvedValue({ id: "mock-id" });
    delegate.deleteMany.mockResolvedValue({ count: 0 });
    delegate.aggregate.mockResolvedValue({ _count: { _all: 0 }, _avg: {}, _sum: {}, _min: {}, _max: {} });
    delegate.groupBy.mockResolvedValue([]);
  }
  prisma.$queryRaw.mockResolvedValue([]);
  prisma.$executeRaw.mockResolvedValue(0);
  prisma.$transaction.mockImplementation((arg: unknown) => {
    if (typeof arg === "function") return (arg as (tx: MockPrisma) => unknown)(prisma);
    return Promise.all(arg as Promise<unknown>[]);
  });
}
