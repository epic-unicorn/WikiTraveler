/**
 * Tier B: CONFIRMED-tier honesty across gossip inbox.
 *
 * 1. Upsert in-bbox property on Node A.
 * 2. Signed inbox injects 3 VERIFIED facts (distinct submittedBy + sourceNodeId) → CONFIRMED.
 * 3. Negative: 3 rows with the SAME submittedBy (different sourceNodeId) → stay VERIFIED.
 *
 * Usage: pnpm gossip:confirmed
 */

import { randomUUID } from "crypto";
import { loadGossipLabPrivateKey } from "./gossip-node-auth.mjs";
import {
  NODE_A,
  NODE_B,
  LAB_COORDS,
  waitForNode,
  waitForPeer,
  upsertProperty,
  deleteProperty,
  ensureAdminToken,
  signInboxBody,
  jsonFetch,
  setNodeRegion,
  dbUrlForNode,
} from "./lib/gossip-lab.mjs";

const FIELD = "step_free_entrance";
const VALUE = "true";

function factRow({ propertyId, sourceNodeId, submittedBy, tier = "VERIFIED" }) {
  return {
    id: randomUUID(),
    propertyId,
    fieldName: FIELD,
    scopeKey: "property",
    value: VALUE,
    tier,
    sourceType: "AUDITOR",
    sourceNodeId,
    submittedBy,
    timestamp: new Date().toISOString(),
    signatureHash: null,
  };
}

async function postInbox(base, payload, signerNodeId, keyId) {
  const body = JSON.stringify(payload);
  const pem = loadGossipLabPrivateKey(signerNodeId);
  const sig = signInboxBody(body, pem, keyId);
  const { res, data } = await jsonFetch(`${base}/api/inbox`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-WikiTraveler-Signature": sig,
    },
    body,
    expectOk: false,
  });
  if (!res.ok) {
    throw new Error(`inbox → ${res.status}: ${data.message ?? JSON.stringify(data)}`);
  }
  return data;
}

async function getCollapsedTier(base, propertyId, token) {
  const { data } = await jsonFetch(`${base}/api/properties/${propertyId}/accessibility`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const facts = data.facts ?? data.collapsedFacts ?? [];
  const hit = facts.find((f) => f.fieldName === FIELD && String(f.value) === VALUE);
  return hit?.tier ?? null;
}

async function main() {
  console.log("Gossip CONFIRMED honesty E2E\n");

  await waitForNode(NODE_A, "Node A");
  // Prefer signing as peer B when linked (mesh-3 / 2-node lab)
  let signerId = "node-a";
  let signerKeyId = NODE_A;
  try {
    await waitForNode(NODE_B, "Node B");
    await waitForPeer(NODE_A, "node-b", "Node A");
    signerId = "node-b";
    signerKeyId = NODE_B;
    console.log("  signing inbox as node-b (peer)");
  } catch (err) {
    console.log(`  (peer B unavailable — signing as node-a: ${err instanceof Error ? err.message : err})`);
  }

  // Ensure A has Eindhoven bbox so in-lab coords survive inbox filtering
  await setNodeRegion(dbUrlForNode("a"), { presetId: "eindhoven" });

  const token = await ensureAdminToken(NODE_A);

  const positiveId = `lab:confirmed-pos-${Date.now()}`;
  const negativeId = `lab:confirmed-neg-${Date.now()}`;

  console.log("1. Positive — 3 distinct auditors → CONFIRMED…");
  const prop = await upsertProperty(NODE_A, {
    canonicalId: positiveId,
    name: "Confirmed Lab Hotel",
    location: "Stratumseind 4, Eindhoven",
    lat: LAB_COORDS.lat,
    lon: LAB_COORDS.lon,
  });
  const remotePropId = randomUUID();
  await postInbox(
    NODE_A,
    {
      fromNodeId: signerId,
      fromNodeUrl: signerKeyId,
      protocolVersion: 2,
      facts: [
        factRow({
          propertyId: remotePropId,
          sourceNodeId: "auditor-node-1",
          submittedBy: "alice@https://home.example",
        }),
        factRow({
          propertyId: remotePropId,
          sourceNodeId: "auditor-node-2",
          submittedBy: "bob@https://home.example",
        }),
        factRow({
          propertyId: remotePropId,
          sourceNodeId: "auditor-node-3",
          submittedBy: "carol@https://home.example",
        }),
      ],
      properties: [
        {
          id: remotePropId,
          canonicalId: positiveId,
          name: prop.name,
          location: prop.location,
          lat: LAB_COORDS.lat,
          lon: LAB_COORDS.lon,
        },
      ],
    },
    signerId,
    signerKeyId
  );

  // Property already exists under positiveId — inbox remaps by canonicalId.
  const tierPos = await getCollapsedTier(NODE_A, prop.id, token);
  if (tierPos !== "CONFIRMED") {
    throw new Error(`Expected CONFIRMED after 3 auditors, got ${tierPos}`);
  }
  console.log("✓ Distinct auditors promoted to CONFIRMED");

  console.log("\n2. Negative — same submittedBy thrice → not CONFIRMED…");
  const propNeg = await upsertProperty(NODE_A, {
    canonicalId: negativeId,
    name: "Confirmed Neg Hotel",
    location: "Stratumseind 5, Eindhoven",
    lat: LAB_COORDS.lat + 0.001,
    lon: LAB_COORDS.lon + 0.001,
  });
  const remoteNeg = randomUUID();
  await postInbox(
    NODE_A,
    {
      fromNodeId: signerId,
      fromNodeUrl: signerKeyId,
      protocolVersion: 2,
      facts: [
        factRow({
          propertyId: remoteNeg,
          sourceNodeId: "copy-node-1",
          submittedBy: "same-auditor@https://home.example",
        }),
        factRow({
          propertyId: remoteNeg,
          sourceNodeId: "copy-node-2",
          submittedBy: "same-auditor@https://home.example",
        }),
        factRow({
          propertyId: remoteNeg,
          sourceNodeId: "copy-node-3",
          submittedBy: "same-auditor@https://home.example",
        }),
      ],
      properties: [
        {
          id: remoteNeg,
          canonicalId: negativeId,
          name: propNeg.name,
          location: propNeg.location,
          lat: LAB_COORDS.lat + 0.001,
          lon: LAB_COORDS.lon + 0.001,
        },
      ],
    },
    signerId,
    signerKeyId
  );

  const tierNeg = await getCollapsedTier(NODE_A, propNeg.id, token);
  if (tierNeg === "CONFIRMED") {
    throw new Error("Same auditor gossiped 3× incorrectly promoted to CONFIRMED");
  }
  console.log(`✓ Same auditor did not inflate (tier=${tierNeg})`);

  await deleteProperty(NODE_A, positiveId).catch(() => {});
  await deleteProperty(NODE_A, negativeId).catch(() => {});

  console.log("\n✓ Gossip CONFIRMED E2E passed");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
