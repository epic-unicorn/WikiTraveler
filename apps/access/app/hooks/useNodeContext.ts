"use client";

import { useState, useEffect, useCallback } from "react";
import {
  DISPLAY_ENV_NODE_URL,
  ENV_NODE_URL,
  getStoredNodeUrl,
  toClientNodeUrl,
  toDisplayNodeUrl,
} from "../lib/accessApi";
import { persistNodeUrlCookie } from "../lib/authStorage";
import { dedupedFetch } from "../lib/clientCache";

interface NodeInfo {
  nodeId?: string;
  region?: string;
  version?: string;
}

/** GPS / map-center resolve outcome for the active data region (RFC-0002 M2). */
export type DataRegionResolve = {
  region: string | null;
  matched: "self" | "peer" | "fallback";
  url: string;
};

export function useNodeContext() {
  const [nodeUrl, setNodeUrlState] = useState(ENV_NODE_URL);
  /** Active data node for search / map / audit routing (may differ from home). */
  const [dataNodeUrl, setDataNodeUrl] = useState(ENV_NODE_URL);
  const [dataRegion, setDataRegion] = useState<DataRegionResolve | null>(null);
  const [nodeInfo, setNodeInfo] = useState<NodeInfo | null>(null);
  const [nodeReachable, setNodeReachable] = useState<boolean | null>(null);

  useEffect(() => {
    const stored = getStoredNodeUrl();
    setNodeUrlState(stored);
    persistNodeUrlCookie(toDisplayNodeUrl(stored));
  }, []);

  useEffect(() => {
    setNodeInfo(null);
    setNodeReachable(null);
    const controller = new AbortController();
    dedupedFetch(`nodeinfo:${nodeUrl}`, async () => {
      const res = await fetch(`${nodeUrl}/api/nodeinfo`);
      if (!res.ok) throw new Error("nodeinfo failed");
      return res.json() as Promise<NodeInfo>;
    })
      .then((d) => {
        setNodeInfo(d);
        setNodeReachable(true);
      })
      .catch(() => {
        if (!controller.signal.aborted) setNodeReachable(false);
      });
    return () => controller.abort();
  }, [nodeUrl]);

  useEffect(() => {
    setDataNodeUrl(nodeUrl);
    // Stay on the home node until the traveler locates or pans the map.
    // Auto-GPS on login caused false "region not covered" banners when
    // permission was pending or the fix sat just outside the node bbox.
    setDataRegion({ region: null, matched: "self", url: nodeUrl });
  }, [nodeUrl]);

  const setNodeUrl = useCallback((url: string) => {
    const displayUrl = toDisplayNodeUrl(url.trim().replace(/\/$/, ""));
    localStorage.setItem("wt_node_url", displayUrl);
    persistNodeUrlCookie(displayUrl);
    setNodeUrlState(toClientNodeUrl(displayUrl));
  }, []);

  const resetNodeUrl = useCallback(() => {
    localStorage.removeItem("wt_node_url");
    persistNodeUrlCookie(DISPLAY_ENV_NODE_URL);
    setNodeUrlState(ENV_NODE_URL);
  }, []);

  return {
    /** Home / identity node (login, resolve, saved signals). */
    nodeUrl,
    homeNodeUrl: nodeUrl,
    /** Data node for search, browse, create, audit routing. */
    dataNodeUrl,
    /** @deprecated Use dataNodeUrl — kept for call sites during M2. */
    searchNodeUrl: dataNodeUrl,
    dataRegion,
    /** @deprecated Use dataRegion */
    gpsResolved: dataRegion
      ? { region: dataRegion.region, matched: dataRegion.matched }
      : null,
    nodeInfo,
    nodeReachable,
    setNodeUrl,
    resetNodeUrl,
  };
}
