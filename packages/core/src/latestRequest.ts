/**
 * Guards async UI updates so only the latest in-flight request commits state.
 * Use one counter per component/effect (typically stored in a ref).
 */
export function createRequestCounter() {
  let latestId = 0;
  return {
    next(): number {
      latestId += 1;
      return latestId;
    },
    isLatest(requestId: number): boolean {
      return requestId === latestId;
    },
  };
}

export type RequestCounter = ReturnType<typeof createRequestCounter>;
