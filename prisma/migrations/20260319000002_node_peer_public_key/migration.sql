-- Migration: add publicKey column to NodePeer for HTTP Signature verification
-- Each peer's RSA public key is fetched once from /api/nodeinfo and cached here.

ALTER TABLE "NodePeer" ADD COLUMN "publicKey" TEXT;
