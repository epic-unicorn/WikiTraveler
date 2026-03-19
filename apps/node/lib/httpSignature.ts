/**
 * lib/httpSignature.ts
 *
 * Minimal HTTP Signature utilities (inspired by ActivityPub's signing approach).
 *
 * Outgoing pushes: sign the raw JSON body with this node's RSA private key.
 * Incoming pushes: verify the signature against the sender's cached public key.
 *
 * Env vars required:
 *   NODE_PRIVATE_KEY — RSA private key in PEM format (no passphrase)
 *   NODE_PUBLIC_KEY  — corresponding RSA public key in PEM format
 *
 * Key generation:
 *   openssl genrsa -out node_private.pem 2048
 *   openssl rsa -in node_private.pem -pubout -out node_public.pem
 *   Then set NODE_PRIVATE_KEY and NODE_PUBLIC_KEY env vars (multi-line → use \n escaping).
 */

import { createSign, createVerify } from "crypto";
import { NODE_URL } from "@/lib/nodeInfo";

/**
 * Sign a request body string with this node's RSA private key.
 * Returns the base64-encoded RSA-SHA256 signature.
 */
export function signBody(body: string): string {
  const privateKey = process.env.NODE_PRIVATE_KEY;
  if (!privateKey) throw new Error("NODE_PRIVATE_KEY env var is not set");
  // Support \n-escaped PEM stored as a single-line env var
  const pem = privateKey.replace(/\\n/g, "\n");
  const sign = createSign("SHA256");
  sign.update(body);
  return sign.sign(pem, "base64");
}

/**
 * Verify a base64-encoded signature against a body using an RSA public key PEM.
 */
export function verifyBody(
  body: string,
  signature: string,
  publicKeyPem: string
): boolean {
  try {
    const pem = publicKeyPem.replace(/\\n/g, "\n");
    const verify = createVerify("SHA256");
    verify.update(body);
    return verify.verify(pem, signature, "base64");
  } catch {
    return false;
  }
}

/**
 * Build the X-WikiTraveler-Signature header value to attach to outgoing pushes.
 * keyId is this node's URL so receivers know whose public key to fetch.
 */
export function buildSignatureHeader(signature: string): string {
  return `keyId="${NODE_URL}",algorithm="rsa-sha256",signature="${signature}"`;
}

/**
 * Parse an X-WikiTraveler-Signature header.
 * Returns null if the header is missing or malformed.
 */
export function parseSignatureHeader(
  header: string
): { keyId: string; signature: string } | null {
  const keyIdMatch = header.match(/keyId="([^"]+)"/);
  const sigMatch = header.match(/signature="([^"]+)"/);
  if (!keyIdMatch || !sigMatch) return null;
  return { keyId: keyIdMatch[1], signature: sigMatch[1] };
}

/**
 * Fetch a peer's RSA public key from its /api/nodeinfo endpoint.
 * Returns null on any network or parsing failure.
 */
export async function fetchPeerPublicKey(
  peerUrl: string
): Promise<string | null> {
  try {
    const res = await fetch(`${peerUrl}/api/nodeinfo`, {
      signal: AbortSignal.timeout(8_000),
      // Bypass Next.js fetch cache so we always get the live key
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { publicKey?: string | null };
    return data.publicKey ?? null;
  } catch {
    return null;
  }
}
