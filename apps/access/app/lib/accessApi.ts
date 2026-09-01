import type { SearchFilters } from "@wikitraveler/ui";
import type { PropertySummary } from "@wikitraveler/ui";
import { readAuthToken } from "./authStorage";
import { dedupedFetch, invalidateClientCache } from "./clientCache";

const RAW_ENV_NODE_URL = process.env.NEXT_PUBLIC_NODE_API_URL ?? "http://localhost:3000";
const DEV_NODE_PROXY_URL = "/node-api";
const LOCAL_NODE_RE = /^https?:\/\/(?:localhost|127\.0\.0\.1):3000\/?$/;

export const DISPLAY_ENV_NODE_URL = RAW_ENV_NODE_URL.replace(/\/$/, "");

export function toClientNodeUrl(url: string): string {
  const clean = url.trim().replace(/\/$/, "");
  if (process.env.NODE_ENV === "development" && LOCAL_NODE_RE.test(clean)) {
    return DEV_NODE_PROXY_URL;
  }
  return clean;
}

export function toDisplayNodeUrl(url: string): string {
  return url === DEV_NODE_PROXY_URL ? DISPLAY_ENV_NODE_URL : url;
}

export const ENV_NODE_URL = toClientNodeUrl(RAW_ENV_NODE_URL);
export const RADIUS_STORAGE_KEY = "wt_nearby_radius_km";

export function getStoredNodeUrl(): string {
  if (typeof window === "undefined") return ENV_NODE_URL;
  return toClientNodeUrl(localStorage.getItem("wt_node_url") ?? RAW_ENV_NODE_URL);
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
  if (filters.hasAccessibleRoom === true) params.set("hasAccessibleRoom", "true");
  if (filters.location?.trim()) params.set("location", filters.location.trim());
  return params;
}

export type PropertySearchPage = {
  properties: PropertySummary[];
  total: number;
  page: number;
  pageSize: number;
};

export async function searchProperties(
  nodeUrl: string,
  q: string,
  filters: SearchFilters,
  signal?: AbortSignal,
  options?: { page?: number; pageSize?: number }
): Promise<PropertySearchPage> {
  const params = buildSearchParams(q, filters);
  const page = options?.page ?? 1;
  const pageSize = options?.pageSize ?? 30;
  params.set("page", String(page));
  params.set("pageSize", String(pageSize));
  const cacheKey = `search:${nodeUrl}:${params.toString()}`;
  return dedupedFetch(
    cacheKey,
    async () => {
      const res = await fetch(`${nodeUrl}/api/properties?${params}`, {
        signal,
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("search failed");
      const data = (await res.json()) as {
        properties?: PropertySummary[];
        total?: number;
        page?: number;
        pageSize?: number;
      };
      const properties = data.properties ?? [];
      return {
        properties,
        total: typeof data.total === "number" ? data.total : properties.length,
        page: typeof data.page === "number" ? data.page : page,
        pageSize: typeof data.pageSize === "number" ? data.pageSize : pageSize,
      };
    },
    3 * 60 * 1000
  );
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

/** Drop cached map pins so the next fetch reflects new/edited properties. */
export function invalidateMapPins(nodeUrl?: string): void {
  invalidateClientCache(nodeUrl ? `map-pins:${nodeUrl}` : "map-pins:");
}

export type MapPinsQuery = {
  bbox: string;
  limit?: number;
  signal?: AbortSignal;
};

export class MapPinsError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.code = code;
  }
}

export async function fetchMapPins(
  nodeUrl: string,
  query: MapPinsQuery
): Promise<MapPin[]> {
  const { bbox, limit, signal } = query;
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
  const params = new URLSearchParams({ bbox });
  if (limit != null) params.set("limit", String(limit));
  const cacheKey = `map-pins:${nodeUrl}:${bbox}:${limit ?? ""}`;
  return dedupedFetch(cacheKey, async () => {
    const res = await fetch(`${nodeUrl}/api/properties/map?${params}`, {
      headers: getAuthHeaders(),
      signal,
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { message?: string; code?: string };
      throw new MapPinsError(body.message ?? "map failed", body.code);
    }
    const data = (await res.json()) as { pins?: MapPin[] };
    return (data.pins ?? []).filter(
      (p) => p.lat != null && p.lon != null && p.lat !== 0 && p.lon !== 0
    );
  });
}

export type CoverageRegion = {
  nodeId: string | null;
  url: string;
  region: string | null;
  bbox: string;
  self?: boolean;
};

/** Peer + self bboxes for low-zoom coverage (from home node). */
export async function fetchCoverageRegions(
  homeNodeUrl: string,
  signal?: AbortSignal
): Promise<CoverageRegion[]> {
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
  return dedupedFetch(`coverage:${homeNodeUrl}`, async () => {
    const [peersRes, infoRes] = await Promise.all([
      fetch(`${homeNodeUrl}/api/peers`, { headers: getAuthHeaders(), signal }),
      fetch(`${homeNodeUrl}/api/nodeinfo`, { signal }),
    ]);
    const out: CoverageRegion[] = [];
    if (infoRes.ok) {
      const info = (await infoRes.json()) as {
        nodeId?: string;
        nodeUrl?: string;
        region?: string | null;
        bbox?: string | null;
      };
      if (info.bbox) {
        out.push({
          nodeId: info.nodeId ?? null,
          url: info.nodeUrl ?? homeNodeUrl,
          region: info.region ?? null,
          bbox: info.bbox,
          self: true,
        });
      }
    }
    if (peersRes.ok) {
      const data = (await peersRes.json()) as {
        peers?: { nodeId?: string | null; url: string; region?: string | null; bbox?: string | null }[];
      };
      for (const p of data.peers ?? []) {
        if (!p.bbox) continue;
        out.push({
          nodeId: p.nodeId ?? null,
          url: p.url,
          region: p.region ?? null,
          bbox: p.bbox,
          self: false,
        });
      }
    }
    return out;
  });
}

export type SearchFieldDto = {
  fieldName: string;
  label: string;
  searchFilter: boolean;
  valueType: string;
};

export async function fetchSearchFields(
  nodeUrl: string,
  locale: string,
  signal?: AbortSignal
): Promise<SearchFieldDto[]> {
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
  return dedupedFetch(`fields:${nodeUrl}:${locale}`, async () => {
    const res = await fetch(`${nodeUrl}/api/fields?locale=${locale}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error("fields failed");
    const data = (await res.json()) as { fields?: SearchFieldDto[] };
    return data.fields ?? [];
  });
}

export type AuditPhotoItem = {
  id: string;
  url: string;
  caption: string | null;
  fieldName: string | null;
  scopeKey: string | null;
  width: number | null;
  height: number | null;
};

export type AuditPhotosPayload = {
  submissionId: string;
  capturedAt: string;
  photos: AuditPhotoItem[];
  photoOriginNode: string | null;
};

export type AuditPhotoHistoryGroup = {
  submissionId: string;
  capturedAt: string;
  auditorToken: string | null;
  photos: AuditPhotoItem[];
};

export type AuditNoteEntry = {
  submissionId: string;
  createdAt: string;
  auditorToken: string | null;
  text: string;
  sourceLocale?: string | null;
  displayText?: string;
  machineTranslated?: boolean;
};

export type PropertyEnrichment = {
  description?: string | null;
  website?: string | null;
  address?: string | null;
  sourceLinks?: Array<{ label: string; url: string }>;
  photos?: Array<{ url: string; caption?: string | null; source?: string }>;
};

export type PropertyAccessibilityResponse = {
  property: {
    id: string;
    name: string;
    location: string;
    lat?: number | null;
    lon?: number | null;
    osmId?: string | null;
    wheelmapId?: string | null;
    address?: string | null;
    description?: string | null;
    website?: string | null;
    sourceLinks?: Array<{ label: string; url: string }>;
    photos?: Array<{ url: string; caption?: string | null; source?: string }>;
    claimedByUserId?: string | null;
    claimedAt?: string | null;
    isClaimedByMe?: boolean;
  };
  facts: Array<{
    fieldName: string;
    scopeKey?: string;
    value: string;
    displayValue?: string;
    tier: string;
    timestamp?: string;
    valueLocale?: string | null;
    machineTranslated?: boolean;
    signatureHash?: string | null;
  }>;
  auditPhotos: AuditPhotosPayload | null;
  auditPhotoHistory?: AuditPhotoHistoryGroup[];
  auditNotes?: AuditNoteEntry[];
  enrichment?: PropertyEnrichment | null;
  hasAiGuess: boolean;
  confidenceSummary?: {
    verifiedCount: number;
    aiGuessCount: number;
    officialCount: number;
    lastAuditAt?: string | null;
  };
};

export async function fetchPropertyAccessibility(
  nodeUrl: string,
  propertyId: string,
  locale: string,
  signal?: AbortSignal
): Promise<PropertyAccessibilityResponse> {
  const res = await fetch(
    `${nodeUrl}/api/properties/${encodeURIComponent(propertyId)}/accessibility?locale=${locale}`,
    { signal, headers: getAuthHeaders(), cache: "no-store" }
  );
  if (!res.ok) throw new Error(`property fetch failed (${res.status})`);
  return res.json() as Promise<PropertyAccessibilityResponse>;
}

export type SignalType = "MISSING" | "INCORRECT" | "OUTDATED" | "LOCATION" | "DEMAND";

export async function submitCommunitySignal(
  nodeUrl: string,
  propertyId: string,
  body: {
    type: SignalType;
    fieldName?: string;
    scopeKey?: string;
    currentValue?: string;
    currentTier?: string;
    suggestedValue?: string;
    note?: string;
    visitDate?: string;
    photos?: string[];
  }
) {
  const res = await fetch(
    `${nodeUrl}/api/properties/${encodeURIComponent(propertyId)}/signals`,
    {
      method: "POST",
      headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
  const data = await res.json() as { message?: string };
  if (!res.ok) throw new Error(data.message ?? "Report failed");
  return data;
}

export async function fetchPropertySignals(
  nodeUrl: string,
  propertyId: string,
  signal?: AbortSignal,
  mine = false
) {
  const res = await fetch(
    `${nodeUrl}/api/properties/${encodeURIComponent(propertyId)}/signals${mine ? "?mine=true" : ""}`,
    { headers: getAuthHeaders(), signal }
  );
  if (!res.ok) throw new Error("signals fetch failed");
  return res.json() as Promise<{
    signals: Array<{
      id: string;
      type: string;
      status: string;
      fieldName: string | null;
      note: string | null;
      createdAt: string;
    }>;
    openCount: number;
  }>;
}

export async function fetchMySignals(nodeUrl: string) {
  return dedupedFetch(`my-signals:${nodeUrl}`, async () => {
    const res = await fetch(`${nodeUrl}/api/auth/my-signals`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error("my signals fetch failed");
    return res.json() as Promise<{
      signals: Array<{
        id: string;
        type: string;
        status: string;
        fieldName: string | null;
        note: string | null;
        createdAt: string;
        property: { id: string; name: string; location: string };
      }>;
    }>;
  });
}

export async function fetchContributorStats(nodeUrl: string) {
  const res = await fetch(`${nodeUrl}/api/auth/contributor-stats`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) return null;
  return res.json() as Promise<{
    role: string;
    signals: { submitted: number; resolved: number; open: number };
    auditsSubmitted: number;
  }>;
}

export async function claimProperty(nodeUrl: string, propertyId: string): Promise<void> {
  const res = await fetch(`${nodeUrl}/api/properties/${encodeURIComponent(propertyId)}/claim`, {
    method: "POST",
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error("claim failed");
}

export async function unclaimProperty(nodeUrl: string, propertyId: string): Promise<void> {
  const res = await fetch(`${nodeUrl}/api/properties/${encodeURIComponent(propertyId)}/claim`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error("unclaim failed");
}
