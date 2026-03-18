import { Tier, TIER_LABEL, TIER_COLOR } from "@wikitraveler/core";

// Re-export core types needed by consumers
export { Tier, TIER_LABEL, TIER_COLOR } from "@wikitraveler/core";
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
}

export interface AccessibilityResponse {
  propertyId: string;
  nodeUrl: string;
  facts: Array<{
    fieldName: string;
    value: string;
    tier: Tier;
    label: string;
    color: string;
    submittedBy: string | null;
    timestamp: string;
  }>;
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export class WikiTraveler {
  private readonly nodeUrl: string;
  private readonly timeoutMs: number;

  constructor(config: WikiTravelerConfig) {
    this.nodeUrl = config.nodeUrl.replace(/\/$/, "");
    this.timeoutMs = config.timeoutMs ?? 8000;
  }

  private async fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
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
    const data = await res.json() as { facts: Array<{ fieldName: string; value: string; tier: Tier; submittedBy: string | null; timestamp: string }> };
    return {
      propertyId,
      nodeUrl: this.nodeUrl,
      facts: data.facts.map((f) => ({
        ...f,
        label: TIER_LABEL[f.tier] ?? f.tier,
        color: TIER_COLOR[f.tier] ?? "#9ca3af",
      })),
    };
  }

  /**
   * Submit a community audit for a property.
   * Requires a valid JWT obtained from POST /api/auth/token.
   */
  async submitAudit(
    propertyId: string,
    payload: { facts: Array<{ fieldName: string; value: string }>; photoUrls?: string[] },
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
