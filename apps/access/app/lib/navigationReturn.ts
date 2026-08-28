import type { SearchFilters } from "@wikitraveler/ui";
import type { DiscoveryViewMode } from "./discoveryUtils";

export const ACCESS_RETURN_KEY = "wt_access_return";

export type AccessTabId = "search" | "saved" | "contribute" | "profile";

export interface AccessReturnState {
  tab?: AccessTabId;
  q?: string;
  view?: DiscoveryViewMode;
  filters?: Pick<SearchFilters, "features" | "audited" | "hasAccessibleRoom">;
}

const VALID_TABS = new Set<AccessTabId>(["search", "saved", "contribute", "profile"]);

/** Legacy tab ids from older deep links map onto the redesign IA. */
const LEGACY_TAB_MAP: Record<string, AccessTabId> = {
  nearby: "search",
  settings: "profile",
};

export function parseAccessTab(value: string | null): AccessTabId {
  if (!value) return "search";
  if (VALID_TABS.has(value as AccessTabId)) return value as AccessTabId;
  if (value in LEGACY_TAB_MAP) return LEGACY_TAB_MAP[value];
  return "search";
}

export function filtersFromSearchParams(params: URLSearchParams): SearchFilters {
  const audited = params.get("audited");
  return {
    features: params.get("features")?.split(",").filter(Boolean) ?? [],
    audited: audited === "1" ? true : audited === "0" ? false : null,
    hasAccessibleRoom: params.get("room") === "1" ? true : null,
    location: "",
  };
}

export function parseDiscoveryView(value: string | null): DiscoveryViewMode | null {
  if (value === "map" || value === "list") return value;
  return null;
}

/** Build a home URL that restores discovery UI state. */
export function buildAccessReturnUrl(state: AccessReturnState): string {
  const params = new URLSearchParams();
  const tab = state.tab ?? "search";
  if (tab !== "search") params.set("tab", tab);
  if (state.q?.trim()) params.set("q", state.q.trim());
  if (state.view && state.view !== "map") params.set("view", state.view);
  if (state.filters) {
    if (state.filters.audited === true) params.set("audited", "1");
    if (state.filters.audited === false) params.set("audited", "0");
    if (state.filters.hasAccessibleRoom) params.set("room", "1");
    if (state.filters.features.length > 0) {
      params.set("features", state.filters.features.join(","));
    }
  }
  const qs = params.toString();
  return qs ? `/?${qs}` : "/";
}

export function saveAccessReturn(state: AccessReturnState): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(ACCESS_RETURN_KEY, buildAccessReturnUrl(state));
}

export function readAccessReturn(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(ACCESS_RETURN_KEY);
}

export function consumeAccessReturn(): string | null {
  const href = readAccessReturn();
  if (href) sessionStorage.removeItem(ACCESS_RETURN_KEY);
  return href;
}
