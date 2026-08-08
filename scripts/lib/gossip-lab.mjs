/**
 * Shared helpers for gossip-lab E2E scripts.
 */

import { createSign } from "crypto";
import { buildNodeAuthHeaders, loadGossipLabPrivateKey } from "../gossip-node-auth.mjs";

export const NODE_A = (process.env.NODE_A_URL ?? "http://localhost:3000").replace(/\/$/, "");
export const NODE_B = (process.env.NODE_B_URL ?? "http://localhost:3010").replace(/\/$/, "");

export const RETRIES = Number(process.env.GOSSIP_LAB_RETRIES ?? 40);
export const RETRY_MS = Number(process.env.GOSSIP_LAB_RETRY_MS ?? 5000);
export const FETCH_RETRIES = Number(process.env.GOSSIP_LAB_FETCH_RETRIES ?? 8);
export const FETCH_RETRY_MS = Number(process.env.GOSSIP_LAB_FETCH_RETRY_MS ?? 2_000);

/** Inside Eindhoven lab bbox (51.39,5.42 → 51.49,5.52) */
export const LAB_COORDS = { lat: 51.438, lon: 5.479 };

/** Clearly outside Eindhoven (Amsterdam area) */
export const OUT_OF_BBOX_COORDS = { lat: 52.3676, lon: 4.9041 };

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function fetchWithRetry(
  url,
  { label, timeoutMs = 8_000, retries = FETCH_RETRIES, retryMs = FETCH_RETRY_MS, init, expectOk = true } = {}
) {
  const name = label ?? url;
  let lastErr;
  for (let i = 1; i <= retries; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), ...init });
      if (expectOk && !res.ok) throw new Error(`${name} → HTTP ${res.status}`);
      return res;
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      if (i < retries) {
        console.log(`  ${name} unavailable (${msg}), retry ${i}/${retries}…`);
        await sleep(retryMs);
      }
    }
  }
  throw new Error(`${name} failed after ${retries} attempts: ${lastErr instanceof Error ? lastErr.message : lastErr}`);
}

export async function jsonFetch(url, opts = {}) {
  const { expectOk = true, timeoutMs = 30_000, ...init } = opts;
  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), ...init });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { message: text };
  }
  if (expectOk && !res.ok) {
    throw new Error(`${url} → ${res.status}: ${data.message ?? text}`);
  }
  return { res, data };
}

export async function waitForNode(base, label) {
  for (let i = 1; i <= RETRIES; i++) {
    try {
      const res = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(5_000) });
      if (res.ok) {
        console.log(`✓ ${label} ready`);
        return;
      }
    } catch {
      // retry
    }
    if (i < RETRIES) {
      console.log(`  waiting for ${label} (${i}/${RETRIES})…`);
      await sleep(RETRY_MS);
    }
  }
  throw new Error(`${label} did not become ready at ${base}`);
}

export async function gossipStats(base) {
  const res = await fetchWithRetry(`${base}/api/dev/gossip-stats`, {
    label: `${base}/api/dev/gossip-stats`,
  });
  return res.json();
}

export async function waitForPeer(base, expectedNodeId, label) {
  for (let i = 1; i <= RETRIES; i++) {
    const stats = await gossipStats(base);
    const peer = (stats.peers ?? []).find((p) => p.nodeId === expectedNodeId && p.isActive);
    if (peer) {
      console.log(`✓ ${label} discovered peer ${expectedNodeId}`);
      return peer;
    }
    if (i < RETRIES) {
      console.log(`  waiting for ${label} to discover ${expectedNodeId} (${i}/${RETRIES})…`);
      await sleep(RETRY_MS);
    }
  }
  throw new Error(`${label} never discovered active peer ${expectedNodeId}`);
}

export async function getProperty(base, canonicalId) {
  const { res, data } = await jsonFetch(
    `${base}/api/dev/property?canonicalId=${encodeURIComponent(canonicalId)}`,
    { expectOk: false }
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`${base} getProperty → ${res.status}: ${data.message}`);
  return data.property;
}

export async function upsertProperty(base, body) {
  const { data } = await jsonFetch(`${base}/api/dev/property`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return data.property;
}

export async function patchProperty(base, body) {
  const { data } = await jsonFetch(`${base}/api/dev/property`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return data.property;
}

export async function deleteProperty(base, canonicalId) {
  const { res, data } = await jsonFetch(
    `${base}/api/dev/property?canonicalId=${encodeURIComponent(canonicalId)}`,
    { method: "DELETE", expectOk: false }
  );
  if (res.status === 404) return false;
  if (!res.ok) throw new Error(`delete ${canonicalId} → ${res.status}: ${data.message}`);
  return true;
}

export async function cronGossip(base) {
  const { data } = await jsonFetch(`${base}/api/cron/gossip`, { timeoutMs: 60_000 });
  return data;
}

/** Peer signs snapshot pulls (node-b → A, node-a → B). */
export const SNAPSHOT_SIGNERS = {
  [NODE_A]: "node-b",
  [NODE_B]: "node-a",
};

export function snapshotAuthHeaders(base, { timestampMs, nodeId, privateKeyPem } = {}) {
  const signerId = nodeId ?? SNAPSHOT_SIGNERS[base];
  if (!signerId && !privateKeyPem) return {};
  try {
    const pem = privateKeyPem ?? loadGossipLabPrivateKey(signerId);
    if (timestampMs != null) {
      const message = `${signerId}.${timestampMs}`;
      const signature = createSign("RSA-SHA256").update(message).sign(pem.replace(/\\n/g, "\n"), "base64url");
      return {
        "X-Node-Id": signerId,
        "X-Node-Timestamp": String(timestampMs),
        "X-Node-Signature": signature,
      };
    }
    return buildNodeAuthHeaders(signerId, pem);
  } catch {
    return {};
  }
}

/** Sign an inbox body the same way apps/node/lib/httpSignature.ts does. */
export function signInboxBody(body, privateKeyPem, keyId) {
  const pem = privateKeyPem.replace(/\\n/g, "\n");
  const signature = createSign("SHA256").update(body).sign(pem, "base64");
  return `keyId="${keyId}",algorithm="rsa-sha256",signature="${signature}"`;
}

export async function pollUntil(predicate, { label, retries = RETRIES, retryMs = RETRY_MS } = {}) {
  for (let i = 1; i <= retries; i++) {
    const value = await predicate();
    if (value) return value;
    if (i < retries) {
      console.log(`  waiting for ${label ?? "condition"} (${i}/${retries})…`);
      await sleep(retryMs);
    }
  }
  throw new Error(`Timed out waiting for ${label ?? "condition"}`);
}
