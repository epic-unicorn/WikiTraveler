// ---------------------------------------------------------------------------
// Reliability Tier
// ---------------------------------------------------------------------------

/** The four trust tiers, ordered from lowest to highest reliability. */
export enum Tier {
  OFFICIAL = "OFFICIAL",     // Sourced from an external directory (e.g. Wikidata) — community baseline from open sources
  AI_GUESS = "AI_GUESS",     // Machine-estimated from photos (deferred)
  VERIFIED = "VERIFIED",     // Verified by a single on-site auditor
  CONFIRMED = "CONFIRMED",   // Independently verified by ≥3 distinct auditors
}

// ---------------------------------------------------------------------------
// Source Type
// ---------------------------------------------------------------------------

/** Which external system or pipeline originated a fact. */
export enum SourceType {
  WIKIDATA = "WIKIDATA",               // Wikidata Q-identifier (open knowledge graph)
  WHEELMAP = "WHEELMAP",               // Wheelmap / OpenStreetMap community data
  OSM = "OSM",                         // OpenStreetMap ingest
  WHEEL_THE_WORLD = "WHEEL_THE_WORLD", // Wheel the World vetted data
  AUDITOR = "AUDITOR",                 // WikiTraveler field audit
}

/** Numeric rank so we can compare tiers arithmetically. */
export const TIER_RANK: Record<Tier, number> = {
  [Tier.OFFICIAL]: 0,
  [Tier.AI_GUESS]: 1,
  [Tier.VERIFIED]: 2,
  [Tier.CONFIRMED]: 3,
};

/** Human-readable label for each tier. */
export const TIER_LABEL: Record<Tier, string> = {
  [Tier.OFFICIAL]: "Official",
  [Tier.AI_GUESS]: "AI Estimate",
  [Tier.VERIFIED]: "Verified",
  [Tier.CONFIRMED]: "Confirmed",
};

/** CSS colour token for each tier (used by UI & widget). */
export const TIER_COLOR: Record<Tier, string> = {
  [Tier.OFFICIAL]: "#9ca3af",    // gray-400
  [Tier.AI_GUESS]: "#fbbf24",    // amber-400
  [Tier.VERIFIED]: "#34d399",    // emerald-400
  [Tier.CONFIRMED]: "#60a5fa",   // blue-400
};

// ---------------------------------------------------------------------------
// Core domain types
// ---------------------------------------------------------------------------

export interface AccessibilityFact {
  id: string;
  propertyId: string;
  fieldName: string;
  scopeKey?: string;
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
  canonicalId: string;
  name: string;
  location: string;
  osmId: string | null;
  wheelmapId: string | null;
}

/** Metadata fields that can be overridden and synced across nodes. */
export type PropertyMetadataFieldName = "name" | "location" | "lat" | "lon";

export const PROPERTY_METADATA_FIELDS: PropertyMetadataFieldName[] = [
  "name",
  "location",
  "lat",
  "lon",
];

export interface PropertyMetadataOverride {
  canonicalId: string;
  fieldName: PropertyMetadataFieldName;
  value: string;
  sourceType: SourceType;
  sourceNodeId: string;
  submittedBy: string | null;
  timestamp: string;
  signatureHash: string | null;
  clearedAt: string | null;
}

export interface NodeInfo {
  nodeId: string;
  version: string;
  url: string;
  region: string;
  bbox: string | null;
  publicKeyPem: string | null;
  peerCount: number;
  factCount: number;
  startedAt: string;
  /** Peers this node knows about — used for organic network discovery. */
  peers?: PeerInfo[];
}

export interface AuditPayload {
  propertyId: string;
  facts: Array<{ fieldName: string; value: string; scopeKey?: string }>;
  /** Base64-encoded images (max 8). Legacy flat array still accepted. */
  photoUrls?: string[];
  /** Structured photo metadata (preferred). */
  photos?: Array<{
    dataUri: string;
    caption?: string;
    fieldName?: string;
    scopeKey?: string;
    width?: number;
    height?: number;
  }>;
  auditorToken?: string;
  locale?: string;
}

// ---------------------------------------------------------------------------
// Gossip types
// ---------------------------------------------------------------------------

export interface GossipDelta {
  fromNodeId: string;
  /** Gossip wire protocol — optional; peers without this field are treated as `1`. */
  protocolVersion?: number;
  since: string;     // ISO-8601 — snapshot covers changes after this timestamp
  until: string;     // ISO-8601
  /** Properties referenced by the facts — allows new nodes to upsert them. */
  properties: (Pick<Property, "id" | "canonicalId" | "name" | "location" | "osmId" | "wheelmapId"> & { lat?: number | null; lon?: number | null })[];
  facts: AccessibilityFact[];
  /** Manual metadata overrides changed since snapshot window. */
  metadataOverrides?: PropertyMetadataOverride[];
  /** Known active peers — propagated during gossip for organic network discovery. */
  peers?: PeerInfo[];
}

export interface PeerInfo {
  nodeId: string;
  url: string;
  region?: string;
  bbox?: string | null;
  /** Peer’s last-known gossip protocol (protocol ≥2 peer exchange). Older peers omit. */
  gossipProtocol?: number | null;
  /** Peer’s last-known node runtime version string. Older peers omit. */
  version?: string | null;
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
  "tactile_paving",
  "roll_in_shower",
  "grab_bars_bathroom",
  "bed_height_cm",
  "turning_circle_cm",
  "pool_lift",
  "service_animal_policy",
  "room_types_available",
  "accessible_room_count",
  "accessible_room_description",
] as const;

export type AccessibilityFieldName = (typeof ACCESSIBILITY_FIELDS)[number];

/**
 * Fields the text-only gap-filler may populate (no photos).
 * Specific attributes (booleans, numbers, times) require photo evidence or a human audit.
 */
export const AI_GAP_FILL_FIELDS = ["notes"] as const;

export type AiGapFillFieldName = (typeof AI_GAP_FILL_FIELDS)[number];
