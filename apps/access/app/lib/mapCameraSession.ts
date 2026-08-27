const MAP_CAMERA_KEY = "wt_access_map_camera";

export type MapCamera = {
  lat: number;
  lon: number;
  zoom: number;
};

export function readMapCamera(): MapCamera | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(MAP_CAMERA_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<MapCamera>;
    const lat = Number(parsed.lat);
    const lon = Number(parsed.lon);
    const zoom = Number(parsed.zoom);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(zoom)) return null;
    if (zoom < 1 || zoom > 22) return null;
    if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
    return { lat, lon, zoom };
  } catch {
    return null;
  }
}

export function saveMapCamera(camera: MapCamera): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(MAP_CAMERA_KEY, JSON.stringify(camera));
}
