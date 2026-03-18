/**
 * A single fact produced by the AI agent (vision or gap-fill).
 * Confidence is always surfaced so callers can decide whether to store or discard.
 */
export interface AgentFact {
  fieldName: string;
  value: string;
  /** "high" is possible from vision; gap-fill always emits "low". */
  confidence: "high" | "medium" | "low";
  /** Human-readable reason the AI chose this value. Stored in signatureHash for audit trail. */
  evidence: string;
}

export interface AnalyzeResult {
  /** Facts derived from analysing photos (may be empty if no photos supplied). */
  visionFacts: AgentFact[];
  /** Facts estimated from property name + location for fields not covered by any existing data. */
  gapFacts: AgentFact[];
}
