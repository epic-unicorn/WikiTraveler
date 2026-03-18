import jwt from "jsonwebtoken";
import type { NextRequest } from "next/server";

const JWT_SECRET = process.env.JWT_SECRET ?? "change-me-in-production";

export function signToken(payload: object, expiresIn = "30d"): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn } as jwt.SignOptions);
}

export function verifyToken(token: string): jwt.JwtPayload | string {
  return jwt.verify(token, JWT_SECRET);
}

/** Extract and verify Bearer token from a Next.js request. Returns payload or throws. */
export function requireAuth(req: NextRequest): jwt.JwtPayload | string {
  const auth = req.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ")) {
    throw new Error("Missing Bearer token");
  }
  return verifyToken(auth.slice(7));
}
