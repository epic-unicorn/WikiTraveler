import jwt from "jsonwebtoken";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { NODE_URL } from "@/lib/nodeInfo";
import { prisma } from "@/lib/prisma";

// Role hierarchy — higher index = more permissions
const ROLE_RANK: Record<string, number> = { USER: 0, AUDITOR: 1, ADMIN: 2 };
export type Role = "USER" | "AUDITOR" | "ADMIN";

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
 * Returns null (authorised) or a 401/403 NextResponse.
 * minRole defaults to USER — pass "AUDITOR" or "ADMIN" to enforce higher access.
 */
export async function requireRole(req: NextRequest, minRole: Role = "USER"): Promise<NextResponse | null> {
  try {
    const auth = req.headers.get("authorization") ?? "";
    if (!auth.startsWith("Bearer ")) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    const payload = await verifyToken(auth.slice(7));
    const role = (payload.role as string | undefined)?.toUpperCase() ?? "USER";
    if ((ROLE_RANK[role] ?? 0) < (ROLE_RANK[minRole] ?? 0)) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }
    return null;
  } catch {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
}

/** Convenience alias — any authenticated user */
export async function requireAuth(req: NextRequest): Promise<NextResponse | null> {
  return requireRole(req, "USER");
}

// ---------------------------------------------------------------------------
// Node-to-node auth — for gossip and /api/nodes routes
// Uses X-Node-Signature: <nodeId>.<timestampMs> signed with sender's private key
// ---------------------------------------------------------------------------

/**
 * Verify an incoming node-to-node request.
 * Signature format: base64url(RSA-SHA256(<nodeId>.<timestampMs>)) in X-Node-Signature.
 * X-Node-Id carries the sender's nodeId.
 * Replay window: 5 minutes.
 */
export async function requireNodeAuth(req: NextRequest): Promise<NextResponse | null> {
  const nodeId = req.headers.get("x-node-id");
  const signature = req.headers.get("x-node-signature");
  const timestampStr = req.headers.get("x-node-timestamp");

  if (!nodeId || !signature || !timestampStr) {
    return NextResponse.json({ message: "Node auth required" }, { status: 401 });
  }

  const timestamp = parseInt(timestampStr, 10);
  if (isNaN(timestamp) || Math.abs(Date.now() - timestamp) > 5 * 60 * 1000) {
    return NextResponse.json({ message: "Request expired" }, { status: 401 });
  }

  // Look up the peer's public key (cached in NodePeer table)
  const peer = await prisma.nodePeer.findFirst({ where: { nodeId } });
  if (!peer?.publicKey) {
    // Try fetching from the peer if we know its URL
    if (peer?.url) {
      try {
        const res = await fetch(`${peer.url}/.well-known/pubkey`, { signal: AbortSignal.timeout(5_000) });
        if (res.ok) {
          const data = await res.json() as { publicKeyPem?: string };
          if (data.publicKeyPem) {
            await prisma.nodePeer.update({ where: { id: peer.id }, data: { publicKey: data.publicKeyPem } });
            return verifyNodeSignature(nodeId, timestamp, signature, data.publicKeyPem);
          }
        }
      } catch { /* fall through */ }
    }
    return NextResponse.json({ message: "Unknown node" }, { status: 401 });
  }

  return verifyNodeSignature(nodeId, timestamp, signature, peer.publicKey);
}

function verifyNodeSignature(
  nodeId: string,
  timestamp: number,
  signature: string,
  publicKeyPem: string,
): NextResponse | null {
  try {
    const crypto = require("crypto") as typeof import("crypto");
    const message = `${nodeId}.${timestamp}`;
    const sigBuf = Buffer.from(signature, "base64url");
    const verify = crypto.createVerify("RSA-SHA256");
    verify.update(message);
    if (!verify.verify(publicKeyPem, sigBuf)) {
      return NextResponse.json({ message: "Invalid signature" }, { status: 401 });
    }
    return null;
  } catch {
    return NextResponse.json({ message: "Signature verification failed" }, { status: 401 });
  }
}
