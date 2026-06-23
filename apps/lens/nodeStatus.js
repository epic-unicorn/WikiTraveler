// nodeStatus.js — shared node URL validation + /api/health check

async function fetchNodeInfo(nodeUrl) {
  const url = (nodeUrl ?? "").trim().replace(/\/$/, "");
  if (!url) return null;
  try {
    const res = await fetch(`${url}/api/nodeinfo`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function buildRegionsLine(nodeInfo, locale) {
  if (!nodeInfo) return null;
  if (!nodeInfo.bbox && !nodeInfo.region) {
    return wtT("ui.regionNotConfigured", locale);
  }

  const labels = [];
  if (nodeInfo.region) labels.push(nodeInfo.region);
  for (const peer of nodeInfo.peers ?? []) {
    if (peer.region && !labels.includes(peer.region)) labels.push(peer.region);
  }
  if (labels.length === 0) return null;
  return wtT("ui.lensSupportedRegions", locale, { regions: labels.join(" · ") });
}

async function checkNodeHealth(nodeUrl, locale = "en") {
  const url = (nodeUrl ?? "").trim().replace(/\/$/, "");
  if (!url) {
    return { state: "invalid", message: wtT("ui.lensEnterNodeUrl", locale) };
  }
  try {
    new URL(url);
  } catch {
    return { state: "invalid", message: wtT("ui.lensUrlInvalid", locale) };
  }

  try {
    const res = await fetch(`${url}/api/health`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) {
      return {
        state: "offline",
        message: wtT("ui.lensNodeReturned", locale, { status: String(res.status) }),
        url,
      };
    }
    const data = await res.json();
    if (data?.ok) {
      const nodeInfo = await fetchNodeInfo(url);
      const label = data.nodeId
        ? wtT("ui.lensNodeOnlineId", locale, { nodeId: data.nodeId })
        : wtT("ui.lensNodeOnline", locale);
      return {
        state: "online",
        message: label,
        url,
        nodeId: data.nodeId,
        nodeUrl: data.url,
        regionsLine: buildRegionsLine(nodeInfo, locale),
      };
    }
    return { state: "offline", message: wtT("ui.unreachable", locale), url };
  } catch {
    return { state: "offline", message: wtT("ui.lensNodeUnreachableUrl", locale), url };
  }
}

function applyNodeStatusEl(el, result) {
  if (!el) return;
  el.className = `node-status node-status--${result.state}`;
  let body = `<span class="node-status-line">${result.message}</span>`;
  if (result.regionsLine) {
    body += `<span class="node-status-regions">${result.regionsLine}</span>`;
  }
  el.innerHTML =
    `<span class="node-status-dot" aria-hidden="true"></span><span class="node-status-body">${body}</span>`;
  const titleParts = [result.nodeUrl ?? result.url, result.regionsLine].filter(Boolean);
  if (titleParts.length > 0) el.title = titleParts.join(" · ");
  else if (result.nodeId) el.title = result.nodeId;
}

function setNodeStatusChecking(el, locale = "en") {
  applyNodeStatusEl(el, {
    state: "checking",
    message: wtT("ui.checking", locale),
  });
}
