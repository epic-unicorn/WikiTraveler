/**
 * instrumentation.ts
 *
 * Next.js 14 instrumentation hook — runs once when the server boots,
 * before any requests are handled.
 *
 * Docs: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 *
 * We use it to:
 * 1. Verify database connectivity
 * 2. Seed bootstrap peers from BOOTSTRAP_PEERS env var
 */
export async function register() {
  // Only run in the Node.js runtime (not the Edge runtime)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // First, check database health before any other operations
    const { checkDatabaseHealth } = await import("@/lib/prisma");
    try {
      await checkDatabaseHealth();
      console.log("✅ [Database] Connected successfully");
    } catch (err) {
      console.error("[instrumentation] Database health check failed — exiting");
      process.exit(1);
    }

    // Then, bootstrap peers (non-critical)
    const { bootstrapPeers } = await import("@/lib/bootstrap");
    try {
      await bootstrapPeers();
    } catch (err) {
      // Never crash startup over bootstrap failures — log and continue
      console.error("[instrumentation] bootstrapPeers failed:", err);
    }
  }
}
