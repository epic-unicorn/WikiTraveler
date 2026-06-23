import { bboxCenter, type Bbox } from "@/lib/bbox";
import { getPresetById } from "@/lib/regionPresets";

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse";

let lastGeocodeAt = 0;

/** Reverse-geocode bbox center via Nominatim (rate-limited to 1 req/s). */
export async function deriveRegionLabel(bbox: Bbox, presetId?: string | null): Promise<string> {
  if (presetId) {
    const preset = getPresetById(presetId);
    if (preset) return preset.label;
  }

  const { lat, lon } = bboxCenter(bbox);
  const now = Date.now();
  const wait = Math.max(0, 1100 - (now - lastGeocodeAt));
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastGeocodeAt = Date.now();

  try {
    const url = new URL(NOMINATIM_URL);
    url.searchParams.set("lat", String(lat));
    url.searchParams.set("lon", String(lon));
    url.searchParams.set("format", "json");
    url.searchParams.set("zoom", "10");

    const res = await fetch(url.toString(), {
      headers: { "User-Agent": "WikiTraveler/0.2 (region-admin)" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return fallbackLabel(bbox);

    const data = (await res.json()) as {
      address?: {
        city?: string;
        town?: string;
        village?: string;
        municipality?: string;
        county?: string;
        state?: string;
        country?: string;
      };
    };
    const a = data.address ?? {};
    const locality = a.city ?? a.town ?? a.village ?? a.municipality ?? a.county;
    const parts = [locality, a.state, a.country].filter(Boolean);
    return parts.length > 0 ? parts.join(", ") : fallbackLabel(bbox);
  } catch {
    return fallbackLabel(bbox);
  }
}

function fallbackLabel(bbox: Bbox): string {
  const { lat, lon } = bboxCenter(bbox);
  return `${lat.toFixed(2)}°, ${lon.toFixed(2)}°`;
}
