/**
 * instrumentation.ts
 *
 * Next.js instrumentation hook — runs once when the server boots,
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

    const { registerWithRegistryDevRetry, startGossipDevBootstrapWatcher } = await import("@/lib/bootstrap");
    // Run peer discovery in the background — do NOT await it here. Next.js waits
    // for register() to resolve before it starts serving HTTP, so awaiting the
    // retry loop would deadlock the gossip lab: both nodes boot together and each
    // would wait (up to ~2 min) for the other's /api/nodeinfo before serving its
    // own. Firing it in the background lets each node serve immediately so peers
    // can discover each other right away.
    void (async () => {
      try {
        await registerWithRegistryDevRetry();
        startGossipDevBootstrapWatcher();
      } catch (err) {
        console.error("[instrumentation] registerWithRegistry failed:", err);
      }
    })();
  }
}
