/**
 * lib/bootstrap.ts
 *
 * Called once at node startup (via the instrumentation hook).
 *
 * Registers this node with the central registry (REGISTRY_URL env var).
 * The registry is the authoritative source for peer discovery — no
 * BOOTSTRAP_PEERS env var is needed.
 */

import { NODE_ID, NODE_REGION, NODE_URL } from "@/lib/nodeInfo";

/**
 * Register this node with the central registry.
 * Reads REGISTRY_URL from env — if not set, skips silently.
 * Fire-and-forget — failures are logged but do not throw.
 */
export async function registerWithRegistry(): Promise<void> {
  const registryUrl = process.env.REGISTRY_URL;
  if (!registryUrl) return;

  try {
    const res = await fetch(`${registryUrl}/api/v1/nodes/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: NODE_URL, nodeId: NODE_ID, region: NODE_REGION }),
      signal: AbortSignal.timeout(8_000),
    });
    if (res.ok) {
      console.log(`[bootstrap] Registered with registry at ${registryUrl}`);
    } else {
      console.warn(`[bootstrap] Registry registration returned ${res.status}`);
    }
  } catch (err) {
    console.warn("[bootstrap] Registry registration failed:", err);
  }
}
