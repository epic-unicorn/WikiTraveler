/**
 * Register a remote node as a local peer (fetch nodeinfo + cache public key).
 */

import { prisma } from "@/lib/prisma";
import { INTERNAL_NODE_URL, NODE_ID, NODE_URL } from "@/lib/nodeInfo";
import {
  fetchRemoteNodeInfo,
  peerVersionFields,
  type RemoteNodeInfo,
} from "@/lib/remoteNodeInfo";
import { fetchPeerJson, PEER_FETCH_PATHS, validatePeerBaseUrl } from "@/lib/peerUrl";
import { canonicalizeLabPeerUrl, labSelfUrlAliases } from "@/lib/gossipLabUrls";

async function fetchPublicKeyPem(peerUrl: string): Promise<string | null> {
  const data = await fetchPeerJson<{ publicKeyPem?: string }>(
    peerUrl,
    PEER_FETCH_PATHS.pubkey,
    { signal: AbortSignal.timeout(5_000) }
  );
  return data?.publicKeyPem ?? null;
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
  const aliases = labSelfUrlAliases(NODE_ID);
  if (aliases.some((a) => a === normalized || a === canonicalizeLabPeerUrl(normalized))) {
    return true;
  }
  return false;
}

function peerUpsertData(info: RemoteNodeInfo, publicKey: string | null) {
  const versionFields = peerVersionFields(info);
  return {
    nodeId: info.nodeId ?? undefined,
    region: info.region ?? undefined,
    bbox: info.bbox ?? undefined,
    publicKey: publicKey ?? undefined,
    lastKnownVersion: versionFields.lastKnownVersion ?? undefined,
    gossipProtocol: versionFields.gossipProtocol ?? undefined,
    lastSeen: new Date(),
    isActive: true,
  };
}

export async function linkPeerUrl(rawUrl: string): Promise<{ ok: true; nodeId: string | null; url: string } | { ok: false; error: string }> {
  const validated = validatePeerBaseUrl(rawUrl);
  if (!validated.ok) {
    return { ok: false, error: validated.reason };
  }
  // Prefer docker-internal URLs in the gossip lab so cron pulls work inside compose.
  const url = canonicalizeLabPeerUrl(validated.url);
  if (isSelfPeer(url)) {
    return { ok: false, error: "Cannot link to self" };
  }

  // Fetch via the original validated URL when it differs (host → docker rewrite).
  const fetchUrl = validated.url;
  const info = await fetchRemoteNodeInfo(fetchUrl);
  if (!info) {
    // Retry docker-internal if host URL was used from inside a container (or vice versa)
    if (fetchUrl !== url) {
      const retry = await fetchRemoteNodeInfo(url);
      if (!retry) {
        return { ok: false, error: `Could not reach ${fetchUrl}/api/nodeinfo` };
      }
      return finalizeLink(url, retry);
    }
    return { ok: false, error: `Could not reach ${fetchUrl}/api/nodeinfo` };
  }

  return finalizeLink(url, info);
}

async function finalizeLink(
  url: string,
  info: RemoteNodeInfo
): Promise<{ ok: true; nodeId: string | null; url: string } | { ok: false; error: string }> {
  if (isSelfPeer(url, info.nodeId)) {
    return { ok: false, error: "Cannot link to self" };
  }

  const publicKey =
    info.publicKeyPem ?? (await fetchPublicKeyPem(url));

  await prisma.nodePeer.upsert({
    where: { url },
    update: peerUpsertData(info, publicKey),
    create: {
      url,
      nodeId: info.nodeId ?? null,
      region: info.region ?? null,
      bbox: info.bbox ?? null,
      publicKey,
      lastKnownVersion: peerVersionFields(info).lastKnownVersion,
      gossipProtocol: peerVersionFields(info).gossipProtocol,
      isActive: true,
    },
  });

  if (Array.isArray(info.peers)) {
    for (const p of info.peers) {
      if (!p.url) continue;
      const peerUrl = canonicalizeLabPeerUrl(p.url);
      if (isSelfPeer(peerUrl, p.nodeId)) continue;
      const pk = await fetchPublicKeyPem(peerUrl);
      await prisma.nodePeer.upsert({
        where: { url: peerUrl },
        update: {
          nodeId: p.nodeId ?? undefined,
          region: p.region ?? undefined,
          bbox: p.bbox ?? undefined,
          publicKey: pk ?? undefined,
          lastSeen: new Date(),
          isActive: true,
        },
        create: {
          url: peerUrl,
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
