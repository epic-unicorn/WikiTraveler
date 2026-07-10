import {
  GOSSIP_PROTOCOL_VERSION,
  MIN_SUPPORTED_GOSSIP_PROTOCOL,
  minorVersionGap,
  parseSemver,
} from "@wikitraveler/core";

export type PeerSkewLevel = "ok" | "warn" | "error";

export interface PeerSkewInfo {
  level: PeerSkewLevel;
  message: string | null;
}

export { minorVersionGap, parseSemver };

export function assessPeerSkew(params: {
  localVersion: string;
  localGossipProtocol: number;
  peerVersion: string | null;
  peerGossipProtocol: number | null;
}): PeerSkewInfo {
  const { localVersion, localGossipProtocol, peerVersion, peerGossipProtocol } = params;

  if (peerGossipProtocol != null) {
    if (peerGossipProtocol < MIN_SUPPORTED_GOSSIP_PROTOCOL) {
      return {
        level: "error",
        message: `Gossip protocol ${peerGossipProtocol} is below minimum ${MIN_SUPPORTED_GOSSIP_PROTOCOL}`,
      };
    }
    if (peerGossipProtocol > localGossipProtocol) {
      return {
        level: "warn",
        message: `Gossip protocol ${peerGossipProtocol} is newer than this node (${GOSSIP_PROTOCOL_VERSION})`,
      };
    }
  }

  if (peerVersion && peerVersion !== "dev" && localVersion !== "dev") {
    const gap = minorVersionGap(localVersion, peerVersion);
    if (gap === null) {
      const localMajor = parseSemver(localVersion)?.major;
      const peerMajor = parseSemver(peerVersion)?.major;
      if (localMajor != null && peerMajor != null && localMajor !== peerMajor) {
        return {
          level: "warn",
          message: `Peer version ${peerVersion} is a different major than ${localVersion}`,
        };
      }
      return {
        level: "warn",
        message: `Unknown peer version "${peerVersion}"`,
      };
    }
    if (gap >= 2) {
      return {
        level: "warn",
        message: `Peer version ${peerVersion} is ${gap} minor releases from ${localVersion} — upgrade recommended`,
      };
    }
  }

  return { level: "ok", message: null };
}
