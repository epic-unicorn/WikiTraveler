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
