import type { SearchFilters } from "@wikitraveler/ui";
import type { PropertySummary } from "@wikitraveler/ui";
import { readAuthToken } from "./authStorage";

export const ENV_NODE_URL = process.env.NEXT_PUBLIC_NODE_API_URL ?? "http://localhost:3000";
export const RADIUS_STORAGE_KEY = "wt_nearby_radius_km";

export function getStoredNodeUrl(): string {
  if (typeof window === "undefined") return ENV_NODE_URL;
  return localStorage.getItem("wt_node_url") ?? ENV_NODE_URL;
}

export function getAuthToken(): string | null {
  return readAuthToken();
}

export function getAuthHeaders(): HeadersInit {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function buildSearchParams(q: string, filters: SearchFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (q.trim()) params.set("q", q.trim());
  if (filters.features.length) params.set("feature", filters.features.join(","));
  if (filters.audited === true) params.set("audited", "true");
  if (filters.audited === false) params.set("audited", "false");
  if (filters.location.trim()) params.set("location", filters.location.trim());
  return params;
}

export async function searchProperties(
  nodeUrl: string,
  q: string,
  filters: SearchFilters,
  signal?: AbortSignal
): Promise<PropertySummary[]> {
  const params = buildSearchParams(q, filters);
  const res = await fetch(`${nodeUrl}/api/properties?${params}`, {
    signal,
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error("search failed");
  const data = (await res.json()) as { properties?: PropertySummary[] };
  return data.properties ?? [];
}

export async function fetchNearbyProperties(
  nodeUrl: string,
  lat: number,
  lon: number,
  radiusKm: number,
  signal?: AbortSignal
): Promise<PropertySummary[]> {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    radiusKm: String(radiusKm),
    limit: "30",
  });
  const res = await fetch(`${nodeUrl}/api/properties/nearby?${params}`, {
    signal,
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error("nearby failed");
  const data = (await res.json()) as { properties?: PropertySummary[] };
  return data.properties ?? [];
}

export async function resolvePeerNode(
  nodeUrl: string,
  lat: number,
  lon: number
): Promise<{ url: string; region: string | null; matched: string } | null> {
  try {
    const res = await fetch(
      `${nodeUrl}/api/peers/resolve?lat=${lat}&lon=${lon}`,
      { signal: AbortSignal.timeout(4000), headers: getAuthHeaders() }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { url: string; region?: string | null; matched: string };
    return { url: data.url, region: data.region ?? null, matched: data.matched };
  } catch {
    return null;
  }
}

export function getStoredRadiusKm(): number {
  if (typeof window === "undefined") return 1;
  const v = Number(localStorage.getItem(RADIUS_STORAGE_KEY));
  return Number.isFinite(v) ? Math.min(5, Math.max(0.5, v)) : 1;
}

export function setStoredRadiusKm(km: number) {
  localStorage.setItem(RADIUS_STORAGE_KEY, String(Math.min(5, Math.max(0.5, km))));
}

export interface MapPin {
  id: string;
  name: string;
  location: string;
  lat: number;
  lon: number;
  audited?: boolean;
  facts?: Record<string, { value: string; tier: string }>;
}

export async function fetchMapPins(
  nodeUrl: string,
  signal?: AbortSignal
): Promise<MapPin[]> {
  const res = await fetch(`${nodeUrl}/api/properties/map`, {
    signal,
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error("map failed");
  const data = (await res.json()) as { pins?: MapPin[] };
  return (data.pins ?? []).filter((p) => p.lat != null && p.lon != null && p.lat !== 0 && p.lon !== 0);
}
