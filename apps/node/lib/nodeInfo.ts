import { randomUUID } from "crypto";

/** Stable node identity — generated once, stored in env NODE_ID, fallback to random. */
export const NODE_ID: string =
  process.env.NODE_ID ?? `node-${randomUUID().slice(0, 8)}`;

export const NODE_VERSION = "0.1.0";

export const NODE_URL: string =
  process.env.NODE_URL ?? "http://localhost:3000";
