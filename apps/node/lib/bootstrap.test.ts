import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    nodePeer: {
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
    user: { findFirst: vi.fn() },
  },
}));

vi.mock("@/lib/nodeInfo", () => ({
  NODE_URL: "http://localhost:3010",
}));

vi.mock("@/lib/linkPeer", () => ({
  isSelfPeer: () => false,
  linkPeerUrl: vi.fn(),
}));

vi.mock("@/lib/gossipLabUrls", () => ({
  canonicalizeLabPeerUrl: (url: string) =>
    url.replace("http://localhost:3020", "http://node-c:3000").replace("http://localhost:3010", "http://node-b:3000"),
}));

import { prisma } from "@/lib/prisma";
import { countLinkedBootstrapSeeds } from "@/lib/bootstrap";

describe("countLinkedBootstrapSeeds", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("counts configured seeds that are already active peers", async () => {
    vi.mocked(prisma.nodePeer.findMany).mockResolvedValue([
      { url: "http://node-a:3000" },
      { url: "http://node-c:3000" },
    ] as never);

    const linked = await countLinkedBootstrapSeeds([
      "http://node-a:3000",
      "http://node-c:3000",
    ]);
    expect(linked).toBe(2);
  });

  it("returns partial count when only one seed is linked", async () => {
    vi.mocked(prisma.nodePeer.findMany).mockResolvedValue([{ url: "http://node-a:3000" }] as never);

    const linked = await countLinkedBootstrapSeeds([
      "http://node-a:3000",
      "http://node-c:3000",
    ]);
    expect(linked).toBe(1);
  });
});
