import { fetchPeerJson, PEER_FETCH_PATHS } from "@/lib/peerUrl";

export interface RemoteNodeInfo {
  nodeId?: string;
  nodeUrl?: string;
  version?: string;
  gossipProtocol?: number;
  minGossipProtocol?: number;
  region?: string;
  bbox?: string | null;
  publicKeyPem?: string | null;
  peers?: Array<{
    nodeId?: string | null;
    url: string;
    region?: string | null;
    bbox?: string | null;
  }>;
}

export function peerVersionFields(info: RemoteNodeInfo): {
  lastKnownVersion: string | null;
  gossipProtocol: number | null;
} {
  return {
    lastKnownVersion: info.version ?? null,
    gossipProtocol:
      typeof info.gossipProtocol === "number" ? info.gossipProtocol : null,
  };
}

export async function fetchRemoteNodeInfo(
  url: string
): Promise<RemoteNodeInfo | null> {
  return fetchPeerJson<RemoteNodeInfo>(url, PEER_FETCH_PATHS.nodeinfo, {
    signal: AbortSignal.timeout(5_000),
  });
}
