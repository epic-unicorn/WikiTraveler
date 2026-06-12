/**
 * Resolve how many properties the AI scan cron should process this run.
 * Default comes from MAX_AI_SCAN_PER_RUN (fallback 20); hard ceiling is 50.
 */
export function resolveAiScanLimit(
  limitParam: string | null,
  maxAiScanPerRun?: string
): number {
  const defaultLimit = Math.min(
    parseInt(maxAiScanPerRun ?? "20", 10) || 20,
    50
  );
  return Math.min(
    parseInt(limitParam ?? String(defaultLimit), 10) || defaultLimit,
    50
  );
}
