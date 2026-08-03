import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createMockPrisma, resetMockPrisma } from "@/lib/test/mockPrisma";
import { discoverRouteCases, routeUrl, type RouteCase } from "@/lib/test/discoverRoutes";

const { nodeSettingsDefaults, statsDefaults, authMocks } = vi.hoisted(() => ({
  nodeSettingsDefaults: {
    openRegistration: false,
    bbox: null,
    region: "Test",
    presetId: null,
    configuredAt: null,
    lastIngestAt: null,
    lastIngestCount: null,
    isConfigured: false,
  },
  statsDefaults: {
    propertyCount: 0,
    factCount: 0,
    auditCount: 0,
    peerCount: 0,
    tierCounts: [],
    sourceCounts: [],
    fieldCounts: [],
    propertiesWithFacts: 0,
    recentAudits30d: 0,
    recentUpdates7d: 0,
    recentUpdates30d: 0,
    oldestPropertyUpdatedAt: null,
    osmLastSync: null,
    osmItemCount: null,
    topAuditedWithNames: [],
    gossipHistory: [],
    coveragePct: 0,
  },
  authMocks: {
    requireRole: vi.fn().mockResolvedValue(null),
    requireNodeAuth: vi.fn().mockResolvedValue(null),
    requireAuth: vi.fn().mockResolvedValue(null),
    getAuthUser: vi.fn().mockResolvedValue({
      username: "testuser",
      role: "ADMIN",
      homeNodeUrl: "http://localhost:3000",
    }),
    verifyToken: vi.fn().mockResolvedValue({ sub: "testuser", role: "ADMIN" }),
    signToken: vi.fn().mockReturnValue("mock-jwt"),
    buildNodeAuthHeaders: vi.fn().mockReturnValue({
      "X-Node-Id": "test-node",
      "X-Node-Timestamp": "1",
      "X-Node-Signature": "mock-sig",
    }),
    auditorId: vi.fn((user: { username: string }) => user.username),
  },
}));

const prismaMock = createMockPrisma();

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

vi.mock("@/lib/auth", () => ({ ...authMocks }));

vi.mock("@/lib/nodeInfo", () => ({
  NODE_ID: "test-node",
  NODE_URL: "http://localhost:3000",
  NODE_VERSION: "0.2.1",
  INTERNAL_NODE_URL: "http://127.0.0.1:3000",
  NODE_REGION: "Test",
}));

vi.mock("@/lib/nodeSettings", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/nodeSettings")>();
  return {
    ...actual,
    getNodeBbox: vi.fn().mockResolvedValue(null),
    getNodeRegionLabel: vi.fn().mockResolvedValue("Test"),
    getNodeSettings: vi.fn().mockImplementation(async () => nodeSettingsDefaults),
    getOpenRegistration: vi.fn().mockResolvedValue(false),
    updateNodeSettings: vi.fn().mockImplementation(async () => nodeSettingsDefaults),
  };
});

vi.mock("@/lib/statsData", () => ({
  loadStatsData: vi.fn().mockImplementation(async () => statsDefaults),
}));

vi.mock("@/lib/releaseManifest", () => ({
  fetchReleaseManifest: vi.fn().mockResolvedValue(null),
  assessUpgrade: vi.fn().mockReturnValue({ level: "ok", message: null, latest: null, minRecommended: null }),
}));

vi.mock("@/lib/remoteNodeInfo", () => ({
  fetchRemoteNodeInfo: vi.fn().mockResolvedValue({
    nodeId: "peer-node",
    version: "0.2.1",
    gossipProtocol: 1,
  }),
  peerVersionFields: vi.fn().mockReturnValue({ lastKnownVersion: "0.2.1", gossipProtocol: 1 }),
}));

vi.mock("@/lib/aiAnalyze", () => ({
  runAiAnalysis: vi.fn().mockResolvedValue({ ok: true }),
}));

vi.mock("@/lib/linkPeer", () => ({
  linkPeer: vi.fn().mockResolvedValue({ ok: true }),
  isSelfPeer: vi.fn().mockReturnValue(false),
}));

vi.mock("@/lib/httpSignature", () => ({
  parseSignatureHeader: vi.fn().mockReturnValue(null),
  verifyBody: vi.fn().mockReturnValue(false),
  fetchPeerPublicKey: vi.fn().mockResolvedValue(null),
}));

const API_ROOT = join(process.cwd(), "app/api");

let routeCases: RouteCase[] = [];

function makeRequest(route: RouteCase): NextRequest {
  const url = routeUrl(route.apiPath, route.params);
  const init: RequestInit = {
    method: route.method,
    headers: {
      authorization: "Bearer mock-jwt",
      "content-type": "application/json",
    },
  };

  if (route.method === "GET" || route.method === "DELETE") {
    return new NextRequest(url, init);
  }

  return new NextRequest(url, {
    ...init,
    body: JSON.stringify({}),
  });
}

async function invokeRoute(route: RouteCase) {
  const mod = await import(route.importPath);
  const handler = mod[route.method] as (
    req: NextRequest,
    ctx: { params: Record<string, string> }
  ) => Promise<Response>;
  const req = makeRequest(route);
  const ctx = { params: route.params };
  return handler.length >= 2 ? handler(req, ctx) : handler(req);
}

function listRouteFiles(dir: string, files: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) listRouteFiles(full, files);
    else if (name === "route.ts") files.push(full);
  }
  return files;
}

/** 500 = uncaught handler failure; 401/404 are valid with minimal env/body. */
function isAcceptableSmokeStatus(status: number): boolean {
  return status > 0 && status < 500;
}

function resetAuthMocks() {
  authMocks.requireRole.mockResolvedValue(null);
  authMocks.requireNodeAuth.mockResolvedValue(null);
  authMocks.requireAuth.mockResolvedValue(null);
  authMocks.getAuthUser.mockResolvedValue({
    username: "testuser",
    role: "ADMIN",
    homeNodeUrl: "http://localhost:3000",
  });
  authMocks.verifyToken.mockResolvedValue({ sub: "testuser", role: "ADMIN" });
  authMocks.signToken.mockReturnValue("mock-jwt");
  authMocks.buildNodeAuthHeaders.mockReturnValue({
    "X-Node-Id": "test-node",
    "X-Node-Timestamp": "1",
    "X-Node-Signature": "mock-sig",
  });
}

beforeAll(async () => {
  process.env.GOSSIP_DEV = "true";
  process.env.NODE_ENV = "test";
  process.env.JWT_SECRET = "test-jwt-secret";
  process.env.OPENAI_API_KEY = "sk-test";
  process.env.CRON_SECRET = "";
  process.env.WHEELMAP_API_KEY = "test-wheelmap-key";

  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/gossip/snapshot")) {
        return new Response(JSON.stringify({ protocolVersion: 1, facts: [], properties: [] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      if (url.includes("/api/nodeinfo") || url.includes("/api/health")) {
        return new Response(
          JSON.stringify({
            nodeId: "peer-node",
            version: "0.2.1",
            gossipProtocol: 1,
            publicKeyPem: "pem",
            peers: [],
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }
      return new Response(JSON.stringify({ ingested: 0, results: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    })
  );

  resetMockPrisma(prismaMock);
  resetAuthMocks();
  routeCases = discoverRouteCases(API_ROOT);
});

describe("API route smoke (mocked Prisma)", () => {
  it(
    "every handler completes without HTTP 500 (mocked DB, no Postgres)",
    async () => {
    expect(routeCases.length).toBeGreaterThanOrEqual(55);
    resetMockPrisma(prismaMock);
    resetAuthMocks();
    const failures: string[] = [];

    for (const route of routeCases) {
      const label = `${route.method} /api/${route.apiPath}`;
      try {
        const res = await invokeRoute(route);
        if (!isAcceptableSmokeStatus(res.status)) {
          const body = await res.text().catch(() => "");
          failures.push(`${label} → HTTP ${res.status}${body ? `: ${body.slice(0, 120)}` : ""}`);
        }
      } catch (err) {
        failures.push(`${label} → ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    expect(failures, failures.join("\n")).toEqual([]);
  },
  30_000
  );
});

describe("API route segment config", () => {
  it("every route.ts exports force-dynamic (build must not hit Postgres)", () => {
    const missing: string[] = [];
    for (const file of listRouteFiles(API_ROOT)) {
      const text = readFileSync(file, "utf8");
      if (!/export const dynamic = ["']force-dynamic["']/.test(text)) {
        missing.push(relative(join(process.cwd(), "app"), file));
      }
    }
    expect(
      missing,
      `Add: export const dynamic = "force-dynamic";\n${missing.join("\n")}`
    ).toEqual([]);
  });
});
