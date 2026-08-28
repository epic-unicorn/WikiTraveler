import type { SearchFilters } from "@wikitraveler/ui";
import type { DiscoveryViewMode } from "./discoveryUtils";

const SEARCH_SESSION_KEY = "wt_access_search_session";

export type SearchSessionState = {
  query: string;
  filters: SearchFilters;
  page: number;
  view: DiscoveryViewMode;
  /** Profile preference keys turned off for this search session. */
  prefOverridesOff?: string[];
};

function defaultFilters(): SearchFilters {
  return {
    features: [],
    audited: null,
    hasAccessibleRoom: null,
    location: "",
  };
}

export function readSearchSession(): SearchSessionState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(SEARCH_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SearchSessionState>;
    const view = parsed.view === "list" || parsed.view === "map" ? parsed.view : "map";
    return {
      query: typeof parsed.query === "string" ? parsed.query : "",
      filters: {
        ...defaultFilters(),
        ...(parsed.filters ?? {}),
        features: Array.isArray(parsed.filters?.features) ? parsed.filters.features : [],
      },
      page: typeof parsed.page === "number" && parsed.page > 0 ? parsed.page : 1,
      view,
      prefOverridesOff: Array.isArray(parsed.prefOverridesOff)
        ? parsed.prefOverridesOff.filter((k): k is string => typeof k === "string")
        : undefined,
    };
  } catch {
    return null;
  }
}

export function writeSearchSession(state: SearchSessionState): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(SEARCH_SESSION_KEY, JSON.stringify(state));
}
