/**
 * instrumentation.ts
 *
 * Next.js 14 instrumentation hook — runs once when the server boots,
 * before any requests are handled.
 *
 * Docs: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 *
 * We use it to seed bootstrap peers from BOOTSTRAP_PEERS env var so a brand
 * new node automatically knows who to gossip with.
 */
export async function register() {
  // Only run in the Node.js runtime (not the Edge runtime)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { bootstrapPeers } = await import("@/lib/bootstrap");
    try {
      await bootstrapPeers();
    } catch (err) {
      // Never crash startup over bootstrap failures — log and continue
      console.error("[instrumentation] bootstrapPeers failed:", err);
    }
  }
}
