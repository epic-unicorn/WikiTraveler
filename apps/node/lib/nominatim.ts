/**
 * Nominatim geocoding helpers (OpenStreetMap).
 * Shared by Node property forms and Access create flow.
 */

const NOMINATIM_SEARCH = "https://nominatim.openstreetmap.org/search";
const NOMINATIM_REVERSE = "https://nominatim.openstreetmap.org/reverse";
const USER_AGENT = "WikiTraveler/0.2";

let lastRequestAt = 0;

async function rateLimitedFetch(url: string): Promise<Response> {
  const wait = Math.max(0, 1100 - (Date.now() - lastRequestAt));
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequestAt = Date.now();
  return fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });
}

/** Format Nominatim address into a concise location string. */
export function formatNominatimAddress(data: {
  display_name?: string;
  address?: Record<string, string>;
}): string | null {
  const a = data.address ?? {};
  const street = [a.road, a.house_number].filter(Boolean).join(" ");
  const city = a.city ?? a.town ?? a.village ?? a.municipality ?? "";
  const concise = [street, [a.postcode, city].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");
  return concise || data.display_name || null;
}

export async function reverseGeocode(
  latitude: number,
  longitude: number
): Promise<string | null> {
  try {
    const url = `${NOMINATIM_REVERSE}?format=jsonv2&addressdetails=1&lat=${latitude}&lon=${longitude}`;
    const res = await rateLimitedFetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      display_name?: string;
      address?: Record<string, string>;
    };
    return formatNominatimAddress(data);
  } catch {
    return null;
  }
}

export async function forwardGeocode(
  address: string,
  options: { countryHint?: string } = {}
): Promise<{ lat: number; lon: number } | null> {
  const hint = options.countryHint ?? "Netherlands";
  const attempts = [
    address,
    new RegExp(`nederland|netherlands|${hint}`, "i").test(address) ? "" : `${address}, ${hint}`,
  ].filter(Boolean);

  for (const query of attempts) {
    try {
      const url = `${NOMINATIM_SEARCH}?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`;
      const res = await rateLimitedFetch(url);
      if (!res.ok) continue;
      const data = (await res.json()) as Array<{ lat?: string; lon?: string }>;
      const hit = data[0];
      if (!hit?.lat || !hit?.lon) continue;
      const lat = Number(hit.lat);
      const lon = Number(hit.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      return { lat, lon };
    } catch {
      continue;
    }
  }
  return null;
}
