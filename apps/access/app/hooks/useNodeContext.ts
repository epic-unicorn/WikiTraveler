"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ENV_NODE_URL,
  getStoredNodeUrl,
  resolvePeerNode,
} from "../lib/fieldKitApi";
import { persistNodeUrlCookie } from "../lib/authStorage";

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
    persistNodeUrlCookie(stored);
  }, []);

  useEffect(() => {
    setNodeInfo(null);
    setNodeReachable(null);
    fetch(`${nodeUrl}/api/nodeinfo`, { signal: AbortSignal.timeout(4000) })
      .then((r) => r.json())
      .then((d: NodeInfo) => {
        setNodeInfo(d);
        setNodeReachable(true);
      })
      .catch(() => setNodeReachable(false));
  }, [nodeUrl]);

  useEffect(() => {
    setSearchNodeUrl(nodeUrl);
    setGpsResolved(null);
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(async (pos) => {
      const data = await resolvePeerNode(
        nodeUrl,
        pos.coords.latitude,
        pos.coords.longitude
      );
      if (data && data.url !== nodeUrl) {
        setSearchNodeUrl(data.url);
        setGpsResolved({ region: data.region ?? null });
      }
    });
  }, [nodeUrl]);

  const setNodeUrl = useCallback((url: string) => {
    localStorage.setItem("wt_node_url", url);
    persistNodeUrlCookie(url);
    setNodeUrlState(url);
  }, []);

  const resetNodeUrl = useCallback(() => {
    localStorage.removeItem("wt_node_url");
    persistNodeUrlCookie(ENV_NODE_URL);
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
