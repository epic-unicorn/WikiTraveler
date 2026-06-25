"use client";

import { useState, useEffect, useCallback } from "react";
import {
  DISPLAY_ENV_NODE_URL,
  ENV_NODE_URL,
  getStoredNodeUrl,
  resolvePeerNode,
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

export function useNodeContext() {
  const [nodeUrl, setNodeUrlState] = useState(ENV_NODE_URL);
  const [searchNodeUrl, setSearchNodeUrl] = useState(ENV_NODE_URL);
  const [gpsResolved, setGpsResolved] = useState<{ region: string | null } | null>(null);
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
    setSearchNodeUrl(nodeUrl);
    setGpsResolved(null);
    if (!navigator.geolocation) return;

    let cancelled = false;
    navigator.geolocation.getCurrentPosition(async (pos) => {
      if (cancelled) return;
      const data = await resolvePeerNode(
        nodeUrl,
        pos.coords.latitude,
        pos.coords.longitude
      );
      if (cancelled) return;
      if (data && data.url !== nodeUrl) {
        setSearchNodeUrl(data.url);
        setGpsResolved({ region: data.region ?? null });
      }
    });
    return () => {
      cancelled = true;
    };
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
    nodeUrl,
    searchNodeUrl,
    gpsResolved,
    nodeInfo,
    nodeReachable,
    setNodeUrl,
    resetNodeUrl,
  };
}
