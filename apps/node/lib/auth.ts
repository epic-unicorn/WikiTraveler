import jwt from "jsonwebtoken";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { NODE_URL } from "@/lib/nodeInfo";

// ---------------------------------------------------------------------------
// Key material
// ---------------------------------------------------------------------------
const PRIVATE_KEY = process.env.NODE_PRIVATE_KEY ?? null;
const PUBLIC_KEY = process.env.NODE_PUBLIC_KEY ?? null;
// Legacy HS256 secret — still accepted for backward compatibility
const JWT_SECRET = process.env.JWT_SECRET ?? "change-me-in-production";

// ---------------------------------------------------------------------------
// Sign — RS256 with NODE_PRIVATE_KEY when available, HS256 fallback for dev
// ---------------------------------------------------------------------------
export function signToken(payload: object, expiresIn = "30d"): string {
  const base = { ...(payload as Record<string, unknown>), homeNodeUrl: NODE_URL };
  if (PRIVATE_KEY) {
    return jwt.sign(base, PRIVATE_KEY, { algorithm: "RS256", expiresIn } as jwt.SignOptions);
  }
  // Dev fallback: HS256
  return jwt.sign(base, JWT_SECRET, { expiresIn } as jwt.SignOptions);
}

// ---------------------------------------------------------------------------
// Verify — handles local RS256, local HS256 (legacy), and remote RS256 tokens
// ---------------------------------------------------------------------------

/** Cache of fetched remote public keys: nodeUrl → PEM */
const remoteKeyCache = new Map<string, string>();

async function fetchRemotePublicKey(homeNodeUrl: string): Promise<string | null> {
  if (remoteKeyCache.has(homeNodeUrl)) return remoteKeyCache.get(homeNodeUrl)!;
  try {
    const res = await fetch(`${homeNodeUrl}/.well-known/pubkey`, {
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return null;
    const data = await res.json() as { publicKeyPem?: string };
    if (!data.publicKeyPem) return null;
    remoteKeyCache.set(homeNodeUrl, data.publicKeyPem);
    return data.publicKeyPem;
  } catch {
    return null;
  }
}

/**
 * Verify any bearer token — own RS256, own HS256 (legacy), or remote RS256.
 * Returns the decoded payload or throws.
 */
export async function verifyToken(token: string): Promise<jwt.JwtPayload> {
  // Decode without verification to inspect which key to use
  const decoded = jwt.decode(token, { complete: true });
  if (!decoded || typeof decoded.payload !== "object") {
    throw new Error("Invalid token");
  }

  const payload = decoded.payload as jwt.JwtPayload & { homeNodeUrl?: string };
  const homeNodeUrl = payload.homeNodeUrl;
  const alg = decoded.header.alg;

  if (alg === "RS256") {
    if (!homeNodeUrl || homeNodeUrl === NODE_URL) {
      // Own RS256 token
      if (!PUBLIC_KEY) throw new Error("No public key configured");
      return jwt.verify(token, PUBLIC_KEY, { algorithms: ["RS256"] }) as jwt.JwtPayload;
    }
    // Foreign RS256 token — fetch issuer's public key
    const remoteKey = await fetchRemotePublicKey(homeNodeUrl);
    if (!remoteKey) throw new Error(`Could not fetch public key from ${homeNodeUrl}`);
    return jwt.verify(token, remoteKey, { algorithms: ["RS256"] }) as jwt.JwtPayload;
  }

  // HS256 — legacy local tokens
  return jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
}

/**
 * Extract and verify Bearer token from a Next.js request.
 * Returns null (authorised) or a 401 NextResponse.
 */
export async function requireAuth(req: NextRequest): Promise<NextResponse | null> {
  try {
    const auth = req.headers.get("authorization") ?? "";
    if (!auth.startsWith("Bearer ")) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    await verifyToken(auth.slice(7));
    return null;
  } catch {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
}
