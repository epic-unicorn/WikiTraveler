#!/usr/bin/env tsx
/**
 * scripts/mock-node.ts
 *
 * Standalone mock WikiTraveler node for local development without PostgreSQL.
 * Serves in-memory data matching the seed fixtures on port 3000.
 *
 * Usage (two terminals):
 *   Terminal 1:  pnpm mock-node
 *   Terminal 2:  pnpm dev:field-kit
 *
 * field-kit defaults to http://localhost:3000, so no extra env vars needed.
 * Override the port:          PORT=3002 pnpm mock-node
 * Override the passphrase:    COMMUNITY_PASSPHRASE=secret pnpm mock-node
 */

import { createServer } from "http";
import { URL } from "url";

const PORT = Number(process.env.PORT ?? 3000);
const PASSPHRASE = process.env.COMMUNITY_PASSPHRASE ?? "dev-passphrase";

// ---------------------------------------------------------------------------
// In-memory data (matches scripts/seed.ts)
// ---------------------------------------------------------------------------

interface MockProperty {
  id: string;
  canonicalId: string;
  name: string;
  location: string;
}

interface MockFact {
  id: string;
  propertyId: string;
  fieldName: string;
  value: string;
  tier: string;
  sourceType: string;
  sourceNodeId: string;
  submittedBy: string | null;
  timestamp: string;
  signatureHash: string | null;
}

const PROPERTIES: MockProperty[] = [
  {
    id: "prop_1",
    canonicalId: "Q610297",
    name: "Grand Hotel Vienna",
    location: "Kärntner Ring 9, 1010 Vienna, Austria",
  },
  {
    id: "prop_2",
    canonicalId: "Q5897396",
    name: "Hotel Arts Barcelona",
    location: "Carrer de la Marina 19-21, 08005 Barcelona, Spain",
  },
  {
    id: "prop_3",
    canonicalId: "Q17371014",
    name: "Pulitzer Amsterdam",
    location: "Prinsengracht 315-331, 1016 GZ Amsterdam, Netherlands",
  },
];

const FACTS: MockFact[] = [
  // Grand Hotel Vienna
  { id: "f1",  propertyId: "prop_1", fieldName: "door_width_cm",       value: "90",  tier: "OFFICIAL", sourceType: "WIKIDATA", sourceNodeId: "mock-node", submittedBy: null, timestamp: "2026-01-01T00:00:00.000Z", signatureHash: null },
  { id: "f2",  propertyId: "prop_1", fieldName: "ramp_present",         value: "yes", tier: "OFFICIAL", sourceType: "WIKIDATA", sourceNodeId: "mock-node", submittedBy: null, timestamp: "2026-01-01T00:00:00.000Z", signatureHash: null },
  { id: "f3",  propertyId: "prop_1", fieldName: "elevator_present",     value: "yes", tier: "OFFICIAL", sourceType: "WIKIDATA", sourceNodeId: "mock-node", submittedBy: null, timestamp: "2026-01-01T00:00:00.000Z", signatureHash: null },
  { id: "f4",  propertyId: "prop_1", fieldName: "elevator_floor_count", value: "8",   tier: "OFFICIAL", sourceType: "WIKIDATA", sourceNodeId: "mock-node", submittedBy: null, timestamp: "2026-01-01T00:00:00.000Z", signatureHash: null },
  { id: "f5",  propertyId: "prop_1", fieldName: "accessible_bathroom",  value: "yes", tier: "OFFICIAL", sourceType: "WIKIDATA", sourceNodeId: "mock-node", submittedBy: null, timestamp: "2026-01-01T00:00:00.000Z", signatureHash: null },
  { id: "f6",  propertyId: "prop_1", fieldName: "step_free_entrance",   value: "yes", tier: "OFFICIAL", sourceType: "WIKIDATA", sourceNodeId: "mock-node", submittedBy: null, timestamp: "2026-01-01T00:00:00.000Z", signatureHash: null },
  // Hotel Arts Barcelona
  { id: "f7",  propertyId: "prop_2", fieldName: "door_width_cm",        value: "80",  tier: "OFFICIAL", sourceType: "WIKIDATA", sourceNodeId: "mock-node", submittedBy: null, timestamp: "2026-01-01T00:00:00.000Z", signatureHash: null },
  { id: "f8",  propertyId: "prop_2", fieldName: "ramp_present",         value: "yes", tier: "OFFICIAL", sourceType: "WIKIDATA", sourceNodeId: "mock-node", submittedBy: null, timestamp: "2026-01-01T00:00:00.000Z", signatureHash: null },
  { id: "f9",  propertyId: "prop_2", fieldName: "elevator_present",     value: "yes", tier: "OFFICIAL", sourceType: "WIKIDATA", sourceNodeId: "mock-node", submittedBy: null, timestamp: "2026-01-01T00:00:00.000Z", signatureHash: null },
  { id: "f10", propertyId: "prop_2", fieldName: "elevator_floor_count", value: "12",  tier: "OFFICIAL", sourceType: "WIKIDATA", sourceNodeId: "mock-node", submittedBy: null, timestamp: "2026-01-01T00:00:00.000Z", signatureHash: null },
  { id: "f11", propertyId: "prop_2", fieldName: "hearing_loop",         value: "no",  tier: "OFFICIAL", sourceType: "WIKIDATA", sourceNodeId: "mock-node", submittedBy: null, timestamp: "2026-01-01T00:00:00.000Z", signatureHash: null },
  { id: "f12", propertyId: "prop_2", fieldName: "parking_accessible",   value: "yes", tier: "OFFICIAL", sourceType: "WIKIDATA", sourceNodeId: "mock-node", submittedBy: null, timestamp: "2026-01-01T00:00:00.000Z", signatureHash: null },
  // Pulitzer Amsterdam
  { id: "f13", propertyId: "prop_3", fieldName: "door_width_cm",        value: "75",  tier: "OFFICIAL", sourceType: "WIKIDATA", sourceNodeId: "mock-node", submittedBy: null, timestamp: "2026-01-01T00:00:00.000Z", signatureHash: null },
  { id: "f14", propertyId: "prop_3", fieldName: "ramp_present",         value: "no",  tier: "OFFICIAL", sourceType: "WIKIDATA", sourceNodeId: "mock-node", submittedBy: null, timestamp: "2026-01-01T00:00:00.000Z", signatureHash: null },
  { id: "f15", propertyId: "prop_3", fieldName: "elevator_present",     value: "yes", tier: "OFFICIAL", sourceType: "WIKIDATA", sourceNodeId: "mock-node", submittedBy: null, timestamp: "2026-01-01T00:00:00.000Z", signatureHash: null },
  { id: "f16", propertyId: "prop_3", fieldName: "step_free_entrance",   value: "no",  tier: "OFFICIAL", sourceType: "WIKIDATA", sourceNodeId: "mock-node", submittedBy: null, timestamp: "2026-01-01T00:00:00.000Z", signatureHash: null },
  { id: "f17", propertyId: "prop_3", fieldName: "notes",                value: "Historic canal house — some rooms have step access.", tier: "OFFICIAL", sourceType: "WIKIDATA", sourceNodeId: "mock-node", submittedBy: null, timestamp: "2026-01-01T00:00:00.000Z", signatureHash: null },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function json(
  res: import("http").ServerResponse,
  data: unknown,
  status = 200
): void {
  res.writeHead(status, { "Content-Type": "application/json", ...CORS_HEADERS });
  res.end(JSON.stringify(data));
}

function readBody(req: import("http").IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

// ---------------------------------------------------------------------------
// Request router
// ---------------------------------------------------------------------------

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
  const method = req.method?.toUpperCase() ?? "GET";
  const path = url.pathname;

  // CORS preflight
  if (method === "OPTIONS") {
    res.writeHead(204, CORS_HEADERS);
    res.end();
    return;
  }

  // GET /api/health
  if (method === "GET" && path === "/api/health") {
    json(res, {
      ok: true,
      nodeId: "mock-node",
      version: "0.1.0",
      url: `http://localhost:${PORT}`,
      factCount: FACTS.length,
      peerCount: 0,
      startedAt: new Date().toISOString(),
    });
    return;
  }

  // GET /api/nodes
  if (method === "GET" && path === "/api/nodes") {
    json(res, { nodes: [] });
    return;
  }

  // GET /api/properties?q=
  if (method === "GET" && path === "/api/properties") {
    const q = url.searchParams.get("q")?.trim().toLowerCase() ?? "";
    const properties = q
      ? PROPERTIES.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            p.location.toLowerCase().includes(q)
        )
      : PROPERTIES;
    json(res, { properties });
    return;
  }

  // GET /api/properties/:id/accessibility
  const accessibilityMatch = path.match(/^\/api\/properties\/([^/]+)\/accessibility$/);
  if (accessibilityMatch) {
    const id = decodeURIComponent(accessibilityMatch[1]);
    const property = PROPERTIES.find((p) => p.id === id);

    if (method === "GET") {
      if (!property) {
        json(res, { message: "Property not found" }, 404);
        return;
      }
      const facts = FACTS.filter((f) => f.propertyId === id);
      json(res, { propertyId: id, property, facts });
      return;
    }

    if (method === "POST") {
      if (!property) {
        json(res, { message: "Property not found" }, 404);
        return;
      }
      // Accept audit submission and update in-memory state
      const rawBody = await readBody(req);
      let body: { facts?: { fieldName: string; value: string }[] } = {};
      try {
        body = JSON.parse(rawBody);
      } catch {
        json(res, { message: "Invalid JSON" }, 400);
        return;
      }
      for (const fact of body.facts ?? []) {
        const existing = FACTS.find(
          (f) => f.propertyId === id && f.fieldName === fact.fieldName && f.sourceNodeId === "mock-node"
        );
        if (existing) {
          existing.value = fact.value;
          existing.tier = "VERIFIED";
          existing.sourceType = "AUDITOR";
          existing.timestamp = new Date().toISOString();
        } else {
          FACTS.push({
            id: `f_${Date.now()}_${Math.random().toString(36).slice(2)}`,
            propertyId: id,
            fieldName: fact.fieldName,
            value: fact.value,
            tier: "VERIFIED",
            sourceType: "AUDITOR",
            sourceNodeId: "mock-node",
            submittedBy: null,
            timestamp: new Date().toISOString(),
            signatureHash: null,
          });
        }
      }
      json(res, { ok: true });
      return;
    }
  }

  // POST /api/auth/token
  if (method === "POST" && path === "/api/auth/token") {
    const rawBody = await readBody(req);
    let body: { passphrase?: string } = {};
    try {
      body = JSON.parse(rawBody);
    } catch {
      json(res, { message: "Invalid JSON" }, 400);
      return;
    }
    if (!body.passphrase || body.passphrase !== PASSPHRASE) {
      json(res, { message: "Invalid passphrase" }, 401);
      return;
    }
    // Return a clearly fake token — not a real JWT
    json(res, { token: "mock-jwt-token.for-development-only.do-not-use-in-production" });
    return;
  }

  json(res, { message: "Not found" }, 404);
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

server.listen(PORT, () => {
  console.log(`\nMock WikiTraveler node  →  http://localhost:${PORT}`);
  console.log(`Community passphrase:      "${PASSPHRASE}"`);
  console.log(`\nEndpoints:`);
  console.log(`  GET  /api/health`);
  console.log(`  GET  /api/nodes`);
  console.log(`  GET  /api/properties?q=`);
  console.log(`  GET  /api/properties/:id/accessibility`);
  console.log(`  POST /api/auth/token              body: { passphrase }`);
  console.log(`  POST /api/properties/:id/accessibility  body: { facts }`);
  console.log(`\nTo start field-kit (new terminal):`);
  console.log(`  pnpm dev:field-kit\n`);
});
