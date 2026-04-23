/**
 * lib/bootstrap.ts
 *
 * Called once at node startup (via the instrumentation hook).
 *
 * Performs organic peer discovery by contacting BOOTSTRAP_PEERS and
 * exchanging nodeinfo. No central registry needed.
 *
 * BOOTSTRAP_PEERS — comma-separated list of seed node URLs.
 *                   Can also include REGISTRY_URL as a legacy seed.
 */

import { NODE_ID, NODE_URL, NODE_REGION, NODE_BBOX } from "@/lib/nodeInfo";
import { prisma } from "@/lib/prisma";

interface RemoteNodeInfo {
  nodeId?: string;
  nodeUrl?: string;
  region?: string;
  bbox?: string | null;
  peers?: Array<{ nodeId?: string | null; url: string; region?: string | null; bbox?: string | null }>;
}

async function fetchNodeInfo(url: string): Promise<RemoteNodeInfo | null> {
  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/api/nodeinfo`, {
      signal: AbortSignal.timeout(5_000),
      headers: { "User-Agent": `WikiTraveler-Node/${NODE_ID}` },
    });
    if (!res.ok) return null;
    return await res.json() as RemoteNodeInfo;
  } catch {
    return null;
  }
}

async function upsertPeer(url: string, info: Partial<RemoteNodeInfo>) {
  try {
    await prisma.nodePeer.upsert({
      where: { url },
      update: {
        nodeId: info.nodeId ?? undefined,
        region: info.region ?? undefined,
        bbox: info.bbox ?? undefined,
        lastSeen: new Date(),
        isActive: true,
      },
      create: {
        url,
        nodeId: info.nodeId,
        region: info.region,
        bbox: info.bbox ?? null,
        isActive: true,
      },
    });
  } catch (err) {
    console.warn(`[bootstrap] Failed to upsert peer ${url}:`, err);
  }
}

/**
 * Bootstrap peer discovery from BOOTSTRAP_PEERS env var.
 *
 * For each seed URL:
 *   1. Fetch /api/nodeinfo
 *   2. Upsert the seed as a NodePeer
 *   3. Upsert any peers it advertises (one hop)
 *
 * Also optionally registers with a legacy REGISTRY_URL if provided.
 */
export async function registerWithRegistry(): Promise<void> {
  // ── Peer exchange ────────────────────────────────────────────────────────
  const seedEnv = process.env.BOOTSTRAP_PEERS ?? "";
  const legacyRegistry = process.env.REGISTRY_URL;

  // Collect seed URLs (deduplicated, exclude self)
  const seeds = [
    ...seedEnv.split(",").map((s) => s.trim()).filter(Boolean),
    ...(legacyRegistry ? [legacyRegistry] : []),
  ].filter((u) => u !== NODE_URL).filter((u, i, a) => a.indexOf(u) === i);

  if (seeds.length === 0) {
    console.info("[bootstrap] No BOOTSTRAP_PEERS configured — running as isolated node.");
    return;
  }

  for (const seedUrl of seeds) {
    const info = await fetchNodeInfo(seedUrl);
    if (!info) {
      console.warn(`[bootstrap] Could not reach seed ${seedUrl}`);
      continue;
    }

    // Seed itself
    await upsertPeer(seedUrl, {
      nodeId: info.nodeId,
      region: info.region,
      bbox: info.bbox,
    });
    console.info(`[bootstrap] Discovered peer ${info.nodeId ?? seedUrl}`);

    // Peers advertised by the seed (one-hop expansion)
    if (Array.isArray(info.peers)) {
      for (const p of info.peers) {
        if (!p.url || p.url === NODE_URL) continue;
        await upsertPeer(p.url, { nodeId: p.nodeId ?? undefined, region: p.region ?? undefined, bbox: p.bbox });
      }
      if (info.peers.length > 0) {
        console.info(`[bootstrap] Seeded ${info.peers.length} additional peers from ${info.nodeId ?? seedUrl}`);
      }
    }
  }

  // ── Legacy registry registration (optional, backward compat) ────────────
  if (legacyRegistry) {
    try {
      const res = await fetch(`${legacyRegistry}/api/v1/nodes/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: NODE_URL, nodeId: NODE_ID, region: NODE_REGION, bbox: NODE_BBOX }),
        signal: AbortSignal.timeout(3_000),
      });
      if (res.ok) {
        console.info(`[bootstrap] Registered with legacy registry at ${legacyRegistry}`);
      }
    } catch {
      console.info(`[bootstrap] Legacy registry unreachable — continuing without it.`);
    }
  }
}

