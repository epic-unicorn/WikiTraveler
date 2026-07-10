/**
 * Node-to-node auth headers for gossip lab scripts (matches apps/node/lib/auth.ts).
 */

import { createSign } from "crypto";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Sign outbound gossip requests: X-Node-Signature = RSA-SHA256("<nodeId>.<timestampMs>"). */
export function buildNodeAuthHeaders(nodeId, privateKeyPem) {
  const pem = privateKeyPem.replace(/\\n/g, "\n");
  const timestamp = Date.now().toString();
  const message = `${nodeId}.${timestamp}`;
  const signature = createSign("RSA-SHA256").update(message).sign(pem, "base64url");
  return {
    "X-Node-Id": nodeId,
    "X-Node-Timestamp": timestamp,
    "X-Node-Signature": signature,
  };
}

/** Load committed gossip-lab dev key (docker/gossip-lab/node-a.private.pem). */
export function loadGossipLabPrivateKey(nodeId) {
  const path = join(ROOT, "docker", "gossip-lab", `${nodeId}.private.pem`);
  return readFileSync(path, "utf8");
}
