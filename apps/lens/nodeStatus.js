// nodeStatus.js — shared node URL validation + /api/health check

async function checkNodeHealth(nodeUrl) {
  const url = (nodeUrl ?? "").trim().replace(/\/$/, "");
  if (!url) {
    return { state: "invalid", message: "Enter a node URL" };
  }
  try {
    new URL(url);
  } catch {
    return { state: "invalid", message: "Invalid node URL" };
  }

  try {
    const res = await fetch(`${url}/api/health`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) {
      return { state: "offline", message: `Node returned ${res.status}`, url };
    }
    const data = await res.json();
    if (data?.ok) {
      const label = data.nodeId ? `Node online · ${data.nodeId}` : "Node online";
      return { state: "online", message: label, url, nodeId: data.nodeId, nodeUrl: data.url };
    }
    return { state: "offline", message: "Node unreachable", url };
  } catch {
    return { state: "offline", message: "Node unreachable — check the URL", url };
  }
}

function applyNodeStatusEl(el, result) {
  if (!el) return;
  el.className = `node-status node-status--${result.state}`;
  el.innerHTML = `<span class="node-status-dot" aria-hidden="true"></span><span>${result.message}</span>`;
  if (result.nodeId) el.title = result.nodeUrl ?? result.url ?? result.nodeId;
}

function setNodeStatusChecking(el) {
  applyNodeStatusEl(el, { state: "checking", message: "Checking connection…" });
}
