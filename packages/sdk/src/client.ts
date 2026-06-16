import { Tier, TIER_COLOR } from "@wikitraveler/core";
import { getFieldLabel, getTierLabel, DEFAULT_LOCALE, type Locale } from "@wikitraveler/i18n";

// Re-export core types needed by consumers
export { Tier, TIER_COLOR } from "@wikitraveler/core";
export { getFieldLabel, getTierLabel, DEFAULT_LOCALE } from "@wikitraveler/i18n";
export type { Locale } from "@wikitraveler/i18n";
export type {
  AccessibilityFact,
  Property,
  NodeInfo,
  AuditPayload,
} from "@wikitraveler/core";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WikiTravelerConfig {
  /** Base URL of a running WikiTraveler node, e.g. "https://my-node.example.com" */
  nodeUrl: string;
  /** Optional fetch timeout in milliseconds (default: 8000). */
  timeoutMs?: number;
  /** Optional JWT obtained from POST /api/auth/login. Required for authenticated endpoints. */
  token?: string;
  /** UI locale for field labels (default: en). */
  locale?: Locale;
}

export interface AuditPhotoInfo {
  id: string;
  url: string;
  caption?: string | null;
  fieldName?: string | null;
  scopeKey?: string | null;
  width?: number | null;
  height?: number | null;
}

export interface AccessibilityResponse {
  propertyId: string;
  nodeUrl: string;
  facts: Array<{
    fieldName: string;
    scopeKey?: string;
    value: string;
    tier: Tier;
    label: string;
    color: string;
    submittedBy: string | null;
    timestamp: string;
  }>;
  auditPhotos?: {
    submissionId: string;
    capturedAt: string;
    photos: AuditPhotoInfo[];
    photoOriginNode?: string | null;
  } | null;
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export class WikiTraveler {
  private readonly nodeUrl: string;
  private readonly timeoutMs: number;
  private readonly token: string | undefined;
  private readonly locale: Locale;

  constructor(config: WikiTravelerConfig) {
    this.nodeUrl = config.nodeUrl.replace(/\/$/, "");
    this.timeoutMs = config.timeoutMs ?? 8000;
    this.token = config.token;
    this.locale = config.locale ?? DEFAULT_LOCALE;
  }

  private async fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    const headers: Record<string, string> = {
      ...(init?.headers as Record<string, string> | undefined),
    };
    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }
    try {
      const res = await fetch(url, { ...init, headers, signal: controller.signal });
      return res;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Fetch all accessibility facts for a property.
   * Returns facts deduplicated to the highest tier per field.
   */
  async getAccessibility(propertyId: string): Promise<AccessibilityResponse> {
    const url = `${this.nodeUrl}/api/properties/${encodeURIComponent(propertyId)}/accessibility`;
    const res = await this.fetchWithTimeout(url);
    if (!res.ok) {
      throw new Error(`WikiTraveler: node returned ${res.status} for ${url}`);
    }
    const data = await res.json() as {
      facts: Array<{ fieldName: string; scopeKey?: string; value: string; tier: Tier; submittedBy: string | null; timestamp: string }>;
      auditPhotos?: AccessibilityResponse["auditPhotos"];
    };
    return {
      propertyId,
      nodeUrl: this.nodeUrl,
      facts: data.facts.map((f) => ({
        ...f,
        label: getFieldLabel(f.fieldName, this.locale),
        color: TIER_COLOR[f.tier] ?? "#9ca3af",
      })),
      auditPhotos: data.auditPhotos ?? null,
    };
  }

  /**
   * Submit a community audit for a property.
   * Requires a valid JWT obtained from POST /api/auth/token.
   */
  async submitAudit(
    propertyId: string,
    payload: {
      facts: Array<{ fieldName: string; value: string; scopeKey?: string }>;
      photoUrls?: string[];
      photos?: Array<{ dataUri: string; caption?: string; fieldName?: string; scopeKey?: string; width?: number; height?: number }>;
      locale?: string;
    },
    token: string
  ): Promise<{ ok: boolean; message: string }> {
    const url = `${this.nodeUrl}/api/properties/${encodeURIComponent(propertyId)}/accessibility`;
    const res = await this.fetchWithTimeout(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json() as { message: string };
    return { ok: res.ok, message: data.message ?? (res.ok ? "Submitted" : "Error") };
  }

  /** Check if the node is reachable and return its identity. */
  async getHealth(): Promise<{ ok: boolean; nodeId?: string; version?: string }> {
    try {
      const res = await this.fetchWithTimeout(`${this.nodeUrl}/api/health`);
      if (!res.ok) return { ok: false };
      const data = await res.json() as { nodeId: string; version: string };
      return { ok: true, nodeId: data.nodeId, version: data.version };
    } catch {
      return { ok: false };
    }
  }
}
