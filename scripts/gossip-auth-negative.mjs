/**
 * Adversarial auth E2E against the gossip lab.
 *
 * Inbox (body signature):
 *   - missing / malformed / wrong signature → 401
 * Snapshot (node auth):
 *   - missing headers / stale timestamp / unknown node / bad sig → 401
 *   - valid peer signature → 200 (positive control)
 *
 * Usage: pnpm gossip:auth-negative
 */

import { createSign } from "crypto";
import { loadGossipLabPrivateKey } from "./gossip-node-auth.mjs";
import {
  NODE_A,
  NODE_B,
  waitForNode,
  waitForPeer,
  snapshotAuthHeaders,
  signInboxBody,
  jsonFetch,
} from "./lib/gossip-lab.mjs";

function assertStatus(label, res, expected) {
  if (res.status !== expected) {
    throw new Error(`${label}: expected HTTP ${expected}, got ${res.status}`);
  }
  console.log(`✓ ${label} → ${res.status}`);
}

async function main() {
  console.log("Gossip auth-negative E2E\n");

  await Promise.all([waitForNode(NODE_A, "Node A"), waitForNode(NODE_B, "Node B")]);
  await waitForPeer(NODE_B, "node-a", "Node B");

  const nodeAPem = loadGossipLabPrivateKey("node-a");
  const nodeBPem = loadGossipLabPrivateKey("node-b");

  const delta = {
    fromNodeId: "node-a",
    fromNodeUrl: NODE_A,
    protocolVersion: 2,
    facts: [],
    metadataOverrides: [],
  };
  const body = JSON.stringify(delta);

  console.log("\nInbox (/api/inbox)…");
  {
    const { res } = await jsonFetch(`${NODE_B}/api/inbox`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      expectOk: false,
    });
    assertStatus("missing X-WikiTraveler-Signature", res, 401);
  }
  {
    const { res } = await jsonFetch(`${NODE_B}/api/inbox`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-WikiTraveler-Signature": "not-a-valid-header",
      },
      body,
      expectOk: false,
    });
    assertStatus("malformed signature header", res, 401);
  }
  {
    const badSig = signInboxBody(body + "tampered", nodeAPem, NODE_A);
    const { res } = await jsonFetch(`${NODE_B}/api/inbox`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-WikiTraveler-Signature": badSig,
      },
      body,
      expectOk: false,
    });
    assertStatus("body signature mismatch", res, 401);
  }
  {
    // Positive control: valid signature with empty facts+overrides still 400 (payload), not 401
    const goodSig = signInboxBody(body, nodeAPem, NODE_A);
    const { res, data } = await jsonFetch(`${NODE_B}/api/inbox`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-WikiTraveler-Signature": goodSig,
      },
      body,
      expectOk: false,
    });
    if (res.status === 401) {
      throw new Error(`valid inbox signature rejected: ${data.message}`);
    }
    // Empty facts/overrides → 400 required fields; auth passed
    if (res.status !== 400 && res.status !== 200) {
      throw new Error(`valid inbox signature unexpected status ${res.status}: ${data.message}`);
    }
    console.log(`✓ valid inbox signature accepted (auth ok, status ${res.status})`);
  }

  console.log("\nSnapshot (/api/gossip/snapshot)…");
  const snapUrl = `${NODE_A}/api/gossip/snapshot?since=1970-01-01T00:00:00.000Z`;

  {
    const { res } = await jsonFetch(snapUrl, { expectOk: false });
    assertStatus("missing node auth", res, 401);
  }
  {
    const stale = Date.now() - 10 * 60 * 1000;
    const headers = snapshotAuthHeaders(NODE_A, { timestampMs: stale, nodeId: "node-b", privateKeyPem: nodeBPem });
    const { res } = await jsonFetch(snapUrl, { headers, expectOk: false });
    assertStatus("stale timestamp (>5 min)", res, 401);
  }
  {
    const unknownId = "node-unknown-e2e";
    const timestamp = Date.now().toString();
    const message = `${unknownId}.${timestamp}`;
    const signature = createSign("RSA-SHA256").update(message).sign(nodeBPem.replace(/\\n/g, "\n"), "base64url");
    const { res } = await jsonFetch(snapUrl, {
      headers: {
        "X-Node-Id": unknownId,
        "X-Node-Timestamp": timestamp,
        "X-Node-Signature": signature,
      },
      expectOk: false,
    });
    assertStatus("unknown node id", res, 401);
  }
  {
    const headers = snapshotAuthHeaders(NODE_A, { nodeId: "node-b", privateKeyPem: nodeBPem });
    headers["X-Node-Signature"] = "AAAA";
    const { res } = await jsonFetch(snapUrl, { headers, expectOk: false });
    assertStatus("invalid node signature", res, 401);
  }
  {
    const headers = snapshotAuthHeaders(NODE_A, { nodeId: "node-b", privateKeyPem: nodeBPem });
    const { res } = await jsonFetch(snapUrl, { headers, expectOk: false });
    assertStatus("valid peer snapshot auth", res, 200);
  }

  console.log("\n✓ Gossip auth-negative E2E passed");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
