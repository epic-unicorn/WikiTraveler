import { peerApiUrl } from "@/lib/peerUrl";
import type { RemoteNodeInfo } from "@/lib/remoteNodeInfo";

export type { RemoteNodeInfo };

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
  const target = peerApiUrl(url, "/api/nodeinfo");
  if (!target) return null;

  try {
    const res = await fetch(target, {
      signal: AbortSignal.timeout(5_000),
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as RemoteNodeInfo;
  } catch {
    return null;
  }
}
