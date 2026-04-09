import { PrismaClient } from "@prisma/client";

// Prevent multiple Prisma Client instances in development (hot-reload)
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

/**
 * Check if the database is reachable.
 * Throws with a clear error message if connection fails.
 */
export async function checkDatabaseHealth(): Promise<void> {
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    const err = error as any;
    const dbUrl = process.env.DATABASE_URL || "unknown";
    
    console.error(
      `\n❌ [Database Error] Cannot connect to database\n` +
      `   Database URL: ${dbUrl}\n` +
      `   Error: ${err?.message || String(error)}\n` +
      `\nPlease ensure:\n` +
      `   1. PostgreSQL is running\n` +
      `   2. DATABASE_URL is correctly configured\n` +
      `   3. Network connectivity is available\n`
    );
    
    throw error;
  }
}
