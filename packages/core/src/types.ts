// ---------------------------------------------------------------------------
// Reliability Tier
// ---------------------------------------------------------------------------

/** The four trust tiers, ordered from lowest to highest reliability. */
export enum Tier {
  OFFICIAL = "OFFICIAL",       // Sourced from Amadeus — unreliable baseline
  AI_GUESS = "AI_GUESS",       // Machine-estimated from photos (deferred)
  COMMUNITY = "COMMUNITY",     // Verified by a single on-site auditor
  MESH_TRUTH = "MESH_TRUTH",   // Consensus-verified by ≥3 distinct nodes
}

// ---------------------------------------------------------------------------
// Source Type
// ---------------------------------------------------------------------------

/** Which external system or pipeline originated a fact. */
export enum SourceType {
  AMADEUS = "AMADEUS",                 // Official GDS feed
  WHEELMAP = "WHEELMAP",               // Wheelmap / OpenStreetMap community data
  WHEEL_THE_WORLD = "WHEEL_THE_WORLD", // Wheel the World vetted data
  COMMUNITY = "COMMUNITY",             // WikiTraveler field audit
}

/** Numeric rank so we can compare tiers arithmetically. */
export const TIER_RANK: Record<Tier, number> = {
  [Tier.OFFICIAL]: 0,
  [Tier.AI_GUESS]: 1,
  [Tier.COMMUNITY]: 2,
  [Tier.MESH_TRUTH]: 3,
};

/** Human-readable label for each tier. */
export const TIER_LABEL: Record<Tier, string> = {
  [Tier.OFFICIAL]: "Official",
  [Tier.AI_GUESS]: "AI Estimate",
  [Tier.COMMUNITY]: "Community Verified",
  [Tier.MESH_TRUTH]: "Mesh Truth",
};

/** CSS colour token for each tier (used by UI & widget). */
export const TIER_COLOR: Record<Tier, string> = {
  [Tier.OFFICIAL]: "#9ca3af",    // gray-400
  [Tier.AI_GUESS]: "#fbbf24",    // amber-400
  [Tier.COMMUNITY]: "#34d399",   // emerald-400
  [Tier.MESH_TRUTH]: "#60a5fa",  // blue-400
};

// ---------------------------------------------------------------------------
// Core domain types
// ---------------------------------------------------------------------------

export interface AccessibilityFact {
  id: string;
  propertyId: string;
  fieldName: string;
  value: string;
  tier: Tier;
  sourceType: SourceType;
  sourceNodeId: string;
  submittedBy: string | null;
  timestamp: string; // ISO-8601
  signatureHash: string | null;
}

export interface Property {
  id: string;
  amadeusId: string;
  name: string;
  location: string;
  osmId: string | null;
  wheelmapId: string | null;
}

export interface NodeInfo {
  nodeId: string;
  version: string;
  url: string;
  peerCount: number;
  factCount: number;
  startedAt: string;
}

export interface AuditPayload {
  propertyId: string;
  facts: Array<{ fieldName: string; value: string }>;
  /** Base64-encoded images (max 3). */
  photoUrls?: string[];
  auditorToken?: string;
}

// ---------------------------------------------------------------------------
// Gossip types
// ---------------------------------------------------------------------------

export interface GossipDelta {
  fromNodeId: string;
  since: string;     // ISO-8601 — snapshot covers changes after this timestamp
  until: string;     // ISO-8601
  facts: AccessibilityFact[];
}

export interface PeerNode {
  id: string;
  url: string;
  lastSeen: string;
  isActive: boolean;
}

// ---------------------------------------------------------------------------
// Accessibility field catalogue
// ---------------------------------------------------------------------------

/** All supported accessibility fields in the Accessibility Module. */
export const ACCESSIBILITY_FIELDS = [
  "door_width_cm",
  "ramp_present",
  "elevator_present",
  "elevator_floor_count",
  "quiet_hours_start",
  "quiet_hours_end",
  "accessible_bathroom",
  "hearing_loop",
  "braille_signage",
  "step_free_entrance",
  "parking_accessible",
  "notes",
] as const;

export type AccessibilityFieldName = (typeof ACCESSIBILITY_FIELDS)[number];
