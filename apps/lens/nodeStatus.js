// nodeStatus.js — shared node URL validation + /api/health check

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
      const label = data.nodeId
        ? wtT("ui.lensNodeOnlineId", locale, { nodeId: data.nodeId })
        : wtT("ui.lensNodeOnline", locale);
      return { state: "online", message: label, url, nodeId: data.nodeId, nodeUrl: data.url };
    }
    return { state: "offline", message: wtT("ui.unreachable", locale), url };
  } catch {
    return { state: "offline", message: wtT("ui.lensNodeUnreachableUrl", locale), url };
  }
}

function applyNodeStatusEl(el, result) {
  if (!el) return;
  el.className = `node-status node-status--${result.state}`;
  el.innerHTML = `<span class="node-status-dot" aria-hidden="true"></span><span>${result.message}</span>`;
  if (result.nodeId) el.title = result.nodeUrl ?? result.url ?? result.nodeId;
}

function setNodeStatusChecking(el, locale = "en") {
  applyNodeStatusEl(el, {
    state: "checking",
    message: wtT("ui.checking", locale),
  });
}
