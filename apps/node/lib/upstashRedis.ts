import { Redis } from "@upstash/redis";

/**
 * Resolve Upstash REST credentials.
 * Supports both the native Upstash names and Vercel Marketplace / KV aliases.
 */
export function resolveUpstashRestEnv(
  env: NodeJS.ProcessEnv = process.env
): { url: string; token: string } | null {
  const url = env.UPSTASH_REDIS_REST_URL?.trim() || env.KV_REST_API_URL?.trim();
  const token =
    env.UPSTASH_REDIS_REST_TOKEN?.trim() || env.KV_REST_API_TOKEN?.trim();
  if (!url || !token) return null;
  return { url, token };
}

/** Redis client for rate limiting, or null when neither env pair is set. */
export function createUpstashRedis(
  env: NodeJS.ProcessEnv = process.env
): Redis | null {
  const creds = resolveUpstashRestEnv(env);
  if (!creds) return null;
  return new Redis({ url: creds.url, token: creds.token });
}
