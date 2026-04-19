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
 * 2. Register this node with the central registry
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

    const { registerWithRegistry } = await import("@/lib/bootstrap");
    try {
      await registerWithRegistry();
    } catch (err) {
      console.error("[instrumentation] registerWithRegistry failed:", err);
    }
  }
}
