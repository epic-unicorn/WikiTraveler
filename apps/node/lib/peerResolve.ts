import { bboxAreaKm2, bboxCenter, containsPoint, parseBbox, type Bbox } from "./bbox";

export type PeerResolveCandidate = {
  url: string;
  nodeId: string | null;
  region: string | null;
  bbox: string | null;
};

/**
 * Among peers whose bbox contains (lat, lon), pick the best match:
 * smallest area first, then nearest bbox center (RFC-0002 M2 / H3).
 */
export function pickBestContainingPeer(
  lat: number,
  lon: number,
  peers: PeerResolveCandidate[]
): PeerResolveCandidate | null {
  const scored: { peer: PeerResolveCandidate; area: number; dist2: number }[] = [];

  for (const peer of peers) {
    const pb = parseBbox(peer.bbox);
    if (!pb || !containsPoint(pb, lat, lon)) continue;
    scored.push({
      peer,
      area: bboxAreaKm2(pb),
      dist2: distanceToCenterSq(pb, lat, lon),
    });
  }

  if (scored.length === 0) return null;

  scored.sort((a, b) => a.area - b.area || a.dist2 - b.dist2);
  return scored[0]!.peer;
}

function distanceToCenterSq(bbox: Bbox, lat: number, lon: number): number {
  const c = bboxCenter(bbox);
  const dLat = c.lat - lat;
  const dLon = c.lon - lon;
  return dLat * dLat + dLon * dLon;
}
