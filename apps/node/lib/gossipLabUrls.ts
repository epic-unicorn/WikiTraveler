/**
 * Gossip-lab URL helpers — map host-published localhost ports ↔ docker DNS.
 *
 * Mesh compose publishes A:3000, B:3010, C:3020 on the host while containers
 * reach each other as http://node-*:3000. JWT homeNodeUrl and inbox fromNodeUrl
 * often carry the host-facing NODE_URL; peers inside Docker must rewrite.
 */

const LAB_HOST_PORT_TO_SERVICE: Record<string, string> = {
  "3000": "node-a",
  "3010": "node-b",
  "3020": "node-c",
};

const LAB_SERVICE_TO_HOST_PORT: Record<string, string> = {
  "node-a": "3000",
  "node-b": "3010",
  "node-c": "3020",
};

function isGossipLabMode(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.GOSSIP_DEV === "true";
}

/** Rewrite host-mapped lab URLs to docker-internal service URLs (and pass-through otherwise). */
export function canonicalizeLabPeerUrl(
  rawUrl: string,
  env: NodeJS.ProcessEnv = process.env
): string {
  const trimmed = rawUrl.trim().replace(/\/$/, "");
  if (!trimmed || !isGossipLabMode(env)) return trimmed;

  try {
    const u = new URL(trimmed);
    const host = u.hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1") {
      const port = u.port || "3000";
      const service = LAB_HOST_PORT_TO_SERVICE[port];
      if (service) return `http://${service}:3000`;
    }
  } catch {
    // leave unchanged
  }
  return trimmed;
}

/**
 * Candidate base URLs for fetching a home node's pubkey.
 * Prefer docker DNS before localhost — inside a container, localhost:3000 is
 * *this* node, not the host-mapped peer on the CI runner.
 */
export function labPubkeyFetchCandidates(
  homeNodeUrl: string,
  env: NodeJS.ProcessEnv = process.env
): string[] {
  const primary = homeNodeUrl.trim().replace(/\/$/, "");
  if (!primary) return [];
  if (!isGossipLabMode(env)) return [primary];

  const canonical = canonicalizeLabPeerUrl(primary, env);
  const out: string[] = [];
  if (canonical && canonical !== primary) out.push(canonical);
  out.push(primary);
  return out;
}

/** Host-mapped aliases that mean "this node" for a given NODE_ID in the gossip lab. */
export function labSelfUrlAliases(
  nodeId: string,
  env: NodeJS.ProcessEnv = process.env
): string[] {
  if (!isGossipLabMode(env)) return [];
  const hostPort = LAB_SERVICE_TO_HOST_PORT[nodeId];
  if (!hostPort) return [];
  return [
    `http://localhost:${hostPort}`,
    `http://127.0.0.1:${hostPort}`,
    `http://${nodeId}:3000`,
  ];
}
