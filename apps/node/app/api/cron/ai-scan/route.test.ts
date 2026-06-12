import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    accessibilityFact: {
      findMany: vi.fn(),
    },
    property: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/aiAnalyze", () => ({ runAiAnalysis: vi.fn() }));

import { GET } from "./route";

describe("GET /api/cron/ai-scan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPENAI_API_KEY = "sk-test";
    process.env.MAX_AI_SCAN_PER_RUN = "15";
    prismaMock.accessibilityFact.findMany.mockResolvedValue([]);
    prismaMock.property.findMany.mockResolvedValue([]);
  });

  it("uses resolveAiScanLimit for the property query take value", async () => {
    const req = new NextRequest("http://localhost/api/cron/ai-scan");
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(prismaMock.property.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 15 })
    );
  });

  it("honours ?limit= over the env default", async () => {
    const req = new NextRequest("http://localhost/api/cron/ai-scan?limit=8");
    await GET(req);
    expect(prismaMock.property.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 8 })
    );
  });
});
