import { randomUUID } from "crypto";

/** Stable node identity — generated once, stored in env NODE_ID, fallback to random. */
export const NODE_ID: string =
  process.env.NODE_ID ?? `node-${randomUUID().slice(0, 8)}`;

export const NODE_VERSION = "0.2.0";

export const NODE_URL: string =
  process.env.NODE_URL ?? "http://localhost:3000";

/** Self-referential server-side calls (docker: 127.0.0.1:PORT, not host-mapped NODE_URL). */
export const INTERNAL_NODE_URL: string =
  process.env.INTERNAL_NODE_URL ?? `http://127.0.0.1:${process.env.PORT ?? "3000"}`;

export const NODE_REGION: string =
  process.env.NODE_REGION ?? "Global";

/** @deprecated Use getNodeBbox() from @/lib/nodeSettings — bbox is configured in admin. */
export const NODE_BBOX: string | null = null;
