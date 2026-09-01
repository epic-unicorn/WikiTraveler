export type PeerResolveResult = {
  url: string;
  region: string | null;
  matched: string;
} | null;

/**
 * Pick a data-node URL from /api/peers/resolve.
 * `fallback` means no bbox contained the point — still use that node (usually
 * home) and fetch data. Only treat the area as uncovered after a successful
 * resolve that matched nothing *and* the caller got an empty result set.
 */
export function dataNodeFromResolve(
  peer: PeerResolveResult,
  homeNodeUrl: string
): { url: string; matched: "self" | "peer" | "fallback" | "home" } {
  if (!peer) return { url: homeNodeUrl, matched: "home" };
  if (peer.matched === "self" || peer.matched === "peer") {
    return { url: peer.url, matched: peer.matched };
  }
  return { url: peer.url || homeNodeUrl, matched: "fallback" };
}

/** True only when resolve confirmed no covering bbox and the data fetch was empty. */
export function isConfirmedUncovered(
  matched: "self" | "peer" | "fallback" | "home",
  resultCount: number
): boolean {
  return matched === "fallback" && resultCount === 0;
}
