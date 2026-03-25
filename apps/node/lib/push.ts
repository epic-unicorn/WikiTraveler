/**
 * lib/push.ts
 *
 * Fire-and-forget peer push for the ActivityPub-inspired fast path.
 *
 * After a field auditor submits a VERIFIED fact, this function pushes it
 * in real-time to all active peers' /api/inbox, rather than waiting for
 * the next scheduled gossip cron cycle.
 *
 * Requires NODE_PRIVATE_KEY env var. If the key is absent (local dev without
 * key setup), the push is silently skipped — the gossip cron remains the
 * safety-net for propagation.
 */

import { prisma } from "@/lib/prisma";
import { NODE_ID, NODE_URL } from "@/lib/nodeInfo";
import { signBody, buildSignatureHeader } from "@/lib/httpSignature";
import type { AccessibilityFact } from "@wikitraveler/core";

type PushProperty = {
  id: string;
  canonicalId: string;
  name: string;
  location: string;
  osmId?: string | null;
  wheelmapId?: string | null;
};

/**
 * Push newly submitted facts to all active peers.
 * Called fire-and-forget after a successful audit submission.
 */
export async function pushFactsToPeers(
  properties: PushProperty[],
  facts: Pick<
    AccessibilityFact,
    | "id"
    | "propertyId"
    | "fieldName"
    | "value"
    | "tier"
    | "sourceType"
    | "sourceNodeId"
    | "submittedBy"
    | "timestamp"
    | "signatureHash"
  >[]
): Promise<void> {
  if (!process.env.NODE_PRIVATE_KEY) return; // skip quietly in dev

  const peers = await prisma.nodePeer.findMany({ where: { isActive: true } });
  if (peers.length === 0) return;

  const payload = JSON.stringify({
    fromNodeId: NODE_ID,
    fromNodeUrl: NODE_URL,
    properties,
    facts,
  });

  let sigHeader: string;
  try {
    sigHeader = buildSignatureHeader(signBody(payload));
  } catch (err) {
    console.warn("[push] Could not sign payload:", err);
    return;
  }

  await Promise.allSettled(
    peers.map((peer) =>
      fetch(`${peer.url}/api/inbox`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-WikiTraveler-Signature": sigHeader,
        },
        body: payload,
        signal: AbortSignal.timeout(10_000),
      })
        .then((res) => {
          if (!res.ok) {
            console.warn(`[push] Peer ${peer.url} returned ${res.status}`);
          }
        })
        .catch((err) => {
          console.warn(`[push] Failed to push to ${peer.url}:`, err);
        })
    )
  );
}
