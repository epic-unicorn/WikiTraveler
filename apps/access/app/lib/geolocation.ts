export type GeoFix = { lat: number; lon: number };

export type GeoFailure = "unsupported" | "denied" | "unavailable" | "insecure";

export type GeoResult =
  | { ok: true; coords: GeoFix }
  | { ok: false; reason: GeoFailure };

async function permissionState(): Promise<PermissionState | "unknown"> {
  if (typeof navigator === "undefined" || !navigator.permissions?.query) return "unknown";
  try {
    const status = await navigator.permissions.query({ name: "geolocation" });
    return status.state;
  } catch {
    return "unknown";
  }
}

function getPosition(options: PositionOptions): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}

function failureReason(err: GeolocationPositionError): GeoFailure {
  if (err.code === err.PERMISSION_DENIED) return "denied";
  return "unavailable";
}

/**
 * Request a GPS fix from a user gesture.
 * Prompts for permission when it has not been granted yet, then retries
 * once with high accuracy if the first reading times out.
 */
export async function requestUserLocation(): Promise<GeoResult> {
  if (typeof window !== "undefined" && !window.isSecureContext) {
    return { ok: false, reason: "insecure" };
  }
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return { ok: false, reason: "unsupported" };
  }

  const perm = await permissionState();
  if (perm === "denied") {
    return { ok: false, reason: "denied" };
  }

  try {
    const pos = await getPosition({
      enableHighAccuracy: false,
      timeout: 15000,
      maximumAge: 30_000,
    });
    return { ok: true, coords: { lat: pos.coords.latitude, lon: pos.coords.longitude } };
  } catch (first) {
    const err = first as GeolocationPositionError;
    if (err.code === err.PERMISSION_DENIED) {
      return { ok: false, reason: "denied" };
    }
    try {
      const pos = await getPosition({
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 0,
      });
      return { ok: true, coords: { lat: pos.coords.latitude, lon: pos.coords.longitude } };
    } catch (second) {
      return { ok: false, reason: failureReason(second as GeolocationPositionError) };
    }
  }
}
