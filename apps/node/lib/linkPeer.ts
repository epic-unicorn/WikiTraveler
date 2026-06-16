/**
 * Register a remote node as a local peer (fetch nodeinfo + cache public key).
 */

import { prisma } from "@/lib/prisma";
import { INTERNAL_NODE_URL, NODE_ID, NODE_URL } from "@/lib/nodeInfo";

interface RemoteNodeInfo {
  nodeId?: string;
  nodeUrl?: string;
  region?: string;
  bbox?: string | null;
  publicKeyPem?: string | null;
  peers?: Array<{ nodeId?: string | null; url: string; region?: string | null; bbox?: string | null }>;
}

async function fetchPublicKeyPem(peerUrl: string): Promise<string | null> {
  try {
    const res = await fetch(`${peerUrl.replace(/\/$/, "")}/.well-known/pubkey`, {
      signal: AbortSignal.timeout(5_000),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { publicKeyPem?: string };
    return data.publicKeyPem ?? null;
  } catch {
    return null;
  }
}

async function fetchNodeInfo(url: string): Promise<RemoteNodeInfo | null> {
  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/api/nodeinfo`, {
      signal: AbortSignal.timeout(5_000),
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as RemoteNodeInfo;
  } catch {
    return null;
  }
}

function peerHostname(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

/** True when a peer URL/id refers to this node (incl. docker service names like node-b:3000). */
export function isSelfPeer(peerUrl: string, peerNodeId?: string | null): boolean {
  if (peerNodeId && peerNodeId === NODE_ID) return true;
  const normalized = peerUrl.replace(/\/$/, "");
  if (normalized === NODE_URL.replace(/\/$/, "")) return true;
  if (normalized === INTERNAL_NODE_URL.replace(/\/$/, "")) return true;
  const host = peerHostname(peerUrl);
  if (host && host === NODE_ID) return true;
  return false;
}

export async function linkPeerUrl(rawUrl: string): Promise<{ ok: true; nodeId: string | null; url: string } | { ok: false; error: string }> {
  const url = rawUrl.replace(/\/$/, "");
  if (isSelfPeer(url)) {
    return { ok: false, error: "Cannot link to self" };
  }

  const info = await fetchNodeInfo(url);
  if (!info) {
    return { ok: false, error: `Could not reach ${url}/api/nodeinfo` };
  }

  if (isSelfPeer(url, info.nodeId)) {
    return { ok: false, error: "Cannot link to self" };
  }

  const publicKey =
    info.publicKeyPem ?? (await fetchPublicKeyPem(url));

  await prisma.nodePeer.upsert({
    where: { url },
    update: {
      nodeId: info.nodeId ?? undefined,
      region: info.region ?? undefined,
      bbox: info.bbox ?? undefined,
      publicKey: publicKey ?? undefined,
      lastSeen: new Date(),
      isActive: true,
    },
    create: {
      url,
      nodeId: info.nodeId ?? null,
      region: info.region ?? null,
      bbox: info.bbox ?? null,
      publicKey,
      isActive: true,
    },
  });

  if (Array.isArray(info.peers)) {
    for (const p of info.peers) {
      if (!p.url || isSelfPeer(p.url, p.nodeId)) continue;
      const pk = await fetchPublicKeyPem(p.url);
      await prisma.nodePeer.upsert({
        where: { url: p.url },
        update: {
          nodeId: p.nodeId ?? undefined,
          region: p.region ?? undefined,
          bbox: p.bbox ?? undefined,
          publicKey: pk ?? undefined,
          lastSeen: new Date(),
          isActive: true,
        },
        create: {
          url: p.url,
          nodeId: p.nodeId ?? null,
          region: p.region ?? null,
          bbox: p.bbox ?? null,
          publicKey: pk,
          isActive: true,
        },
      });
    }
  }

  return { ok: true, nodeId: info.nodeId ?? null, url };
}
