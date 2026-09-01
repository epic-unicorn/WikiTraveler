import { describe, expect, it, vi, beforeEach } from "vitest";
import { reconcileFactsAfterSubmissionDelete } from "./auditReconcile";

const { prismaMock, invalidateFactTranslations } = vi.hoisted(() => ({
  prismaMock: {
    accessibilityFact: {
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
  },
  invalidateFactTranslations: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/fieldRegistry", () => ({
  getFieldRegistryMap: vi.fn(async () => new Map()),
  factValuesMatch: (_d: unknown, a: string, b: string) => a === b,
}));
vi.mock("@/lib/translation", () => ({ invalidateFactTranslations }));
vi.mock("@/lib/nodeInfo", () => ({ NODE_ID: "test-node" }));

describe("reconcileFactsAfterSubmissionDelete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("removes facts that match the deleted submission", async () => {
    prismaMock.accessibilityFact.findUnique.mockResolvedValue({
      id: "fact-1",
      value: "yes",
      submittedBy: "alice@test",
    });
    prismaMock.accessibilityFact.delete.mockResolvedValue({});

    const result = await reconcileFactsAfterSubmissionDelete({
      propertyId: "prop-1",
      deletedSubmissionId: "sub-old",
      deletedFacts: [{ fieldName: "ramp_present", value: "yes", scopeKey: "property" }],
      deletedAuditor: "alice@test",
      deletedAt: new Date("2026-01-02T00:00:00Z"),
      remainingSubmissions: [],
    });

    expect(result.removed).toBe(1);
    expect(prismaMock.accessibilityFact.delete).toHaveBeenCalledWith({ where: { id: "fact-1" } });
  });

  it("skips facts superseded by a newer submission", async () => {
    const result = await reconcileFactsAfterSubmissionDelete({
      propertyId: "prop-1",
      deletedSubmissionId: "sub-old",
      deletedFacts: [{ fieldName: "ramp_present", value: "yes" }],
      deletedAuditor: "alice@test",
      deletedAt: new Date("2026-01-01T00:00:00Z"),
      remainingSubmissions: [
        {
          id: "sub-new",
          createdAt: new Date("2026-01-02T00:00:00Z"),
          facts: [{ fieldName: "ramp_present", value: "no" }],
        },
      ],
    });

    expect(result.removed).toBe(0);
    expect(result.skipped).toBe(1);
    expect(prismaMock.accessibilityFact.findUnique).not.toHaveBeenCalled();
  });
});
