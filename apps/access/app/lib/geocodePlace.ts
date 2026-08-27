export type GeocodedPlace = {
  lat: number;
  lon: number;
  displayName: string;
  /** Short place label for location= filter (city / town / country). */
  locationLabel: string;
  bbox?: { minLat: number; minLon: number; maxLat: number; maxLon: number };
};

/**
 * Forward-geocode a free-text place (city, street, country) via Nominatim.
 * Returns null when nothing useful matched.
 */
export async function geocodePlace(
  query: string,
  signal?: AbortSignal
): Promise<GeocodedPlace | null> {
  const q = query.trim();
  if (q.length < 2) return null;

  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=1&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, {
    signal,
    headers: { Accept: "application/json" },
  });
  if (!res.ok) return null;
  const rows = (await res.json()) as Array<{
    lat: string;
    lon: string;
    display_name?: string;
    boundingbox?: [string, string, string, string];
    address?: Record<string, string>;
    type?: string;
    class?: string;
  }>;
  const hit = rows[0];
  if (!hit) return null;

  const lat = Number(hit.lat);
  const lon = Number(hit.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  const addr = hit.address ?? {};
  const locationLabel =
    addr.city ||
    addr.town ||
    addr.village ||
    addr.municipality ||
    addr.county ||
    addr.state ||
    addr.country ||
    q;

  let bbox: GeocodedPlace["bbox"];
  if (hit.boundingbox?.length === 4) {
    const [minLat, maxLat, minLon, maxLon] = hit.boundingbox.map(Number);
    if ([minLat, maxLat, minLon, maxLon].every(Number.isFinite)) {
      bbox = { minLat, maxLat, minLon, maxLon };
    }
  }

  return {
    lat,
    lon,
    displayName: hit.display_name ?? locationLabel,
    locationLabel,
    bbox,
  };
}

/** Heuristic: treat short queries without digits as place-first searches. */
export function looksLikePlaceQuery(q: string): boolean {
  const t = q.trim();
  if (t.length < 3) return false;
  if (/\d/.test(t)) return false;
  return true;
}
