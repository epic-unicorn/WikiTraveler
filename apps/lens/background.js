// background.js — service worker

import { DEFAULT_NODE_URL, isAllowedNodeUrl } from "./lensLogic.js";

// ── Extension icon ────────────────────────────────────────────────────────────
// Draw the WikiTraveler LogoMark (hexagon + chevron + bar) in white on brand
// blue onto OffscreenCanvas, then set it as the action icon for all sizes.

function drawLogoMark(ctx, size) {
  const s = size / 32;

  // Brand-blue background (matches Lens toolbar icons)
  ctx.fillStyle = "#1e40af";
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = "#ffffff";
  ctx.fillStyle = "#ffffff";

  // Hexagon outline
  ctx.lineWidth = 1.75 * s;
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(16 * s, 2 * s);
  ctx.lineTo(28 * s, 9 * s);
  ctx.lineTo(28 * s, 23 * s);
  ctx.lineTo(16 * s, 30 * s);
  ctx.lineTo(4 * s,  23 * s);
  ctx.lineTo(4 * s,  9 * s);
  ctx.closePath();
  ctx.stroke();

  // Compass chevron (filled triangle)
  ctx.beginPath();
  ctx.moveTo(16 * s, 9 * s);
  ctx.lineTo(20 * s, 15 * s);
  ctx.lineTo(12 * s, 15 * s);
  ctx.closePath();
  ctx.fill();

  // Accessibility bar
  ctx.lineWidth = 2 * s;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(10 * s, 20 * s);
  ctx.lineTo(22 * s, 20 * s);
  ctx.stroke();
}

async function setExtensionIcon() {
  try {
    const sizes = [16, 32, 48, 128];
    const imageData = {};
    for (const size of sizes) {
      const canvas = new OffscreenCanvas(size, size);
      const ctx = canvas.getContext("2d");
      drawLogoMark(ctx, size);
      imageData[size] = ctx.getImageData(0, 0, size, size);
    }
    await chrome.action.setIcon({ imageData });
  } catch (err) {
    console.warn("[Lens] Could not set extension icon:", err);
  }
}

chrome.runtime.onInstalled.addListener(setExtensionIcon);
chrome.runtime.onStartup.addListener(setExtensionIcon);

// ── Node API fetch (service worker — host_permissions, not page CORS) ─────────

async function handleNodeFetch(msg) {
  if (!msg.url || !isAllowedNodeUrl(msg.url)) {
    return { error: "Invalid node URL" };
  }
  const method = (msg.method ?? "GET").toUpperCase();
  const timeoutMs = typeof msg.timeoutMs === "number" ? msg.timeoutMs : 8000;
  try {
    const init = {
      method,
      headers: msg.headers ?? {},
      signal: AbortSignal.timeout(timeoutMs),
    };
    if (msg.body != null && method !== "GET" && method !== "HEAD") {
      init.body = msg.body;
    }
    const res = await fetch(msg.url, init);
    const contentType = res.headers.get("content-type") ?? "";
    const body = await res.text();
    let json = undefined;
    if (contentType.includes("application/json") || contentType.includes("+json")) {
      try {
        json = JSON.parse(body);
      } catch {
        json = undefined;
      }
    }
    return {
      ok: res.ok,
      status: res.status,
      statusText: res.statusText,
      headers: { "content-type": contentType },
      body,
      ...(json !== undefined ? { json } : {}),
    };
  } catch (err) {
    return { error: err?.message ?? "Node fetch failed" };
  }
}

// ── Message handling ──────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "GET_NODE_URL") {
    chrome.storage.sync.get({ nodeUrl: DEFAULT_NODE_URL }, (items) => {
      sendResponse({ nodeUrl: items.nodeUrl });
    });
    return true; // keep channel open for async response
  }

  if (msg.type === "NODE_FETCH") {
    handleNodeFetch(msg).then(sendResponse);
    return true;
  }

  if (msg.type === "RESOLVE_NODE") {
    // Given { lat, lon }, ask this node's /api/peers/resolve for the best regional node.
    // Falls back to the stored nodeUrl if the call fails or no coordinates given.
    chrome.storage.sync.get({ nodeUrl: DEFAULT_NODE_URL, wtToken: null }, async (items) => {
      const { nodeUrl, wtToken } = items;
      if (msg.lat == null || msg.lon == null) {
        sendResponse({ nodeUrl, regionMissing: false });
        return;
      }
      const headers = wtToken ? { Authorization: `Bearer ${wtToken}` } : {};
      try {
        const result = await handleNodeFetch({
          url: `${nodeUrl}/api/peers/resolve?lat=${encodeURIComponent(msg.lat)}&lon=${encodeURIComponent(msg.lon)}`,
          method: "GET",
          headers,
          timeoutMs: 4000,
        });
        if (result.ok && result.json) {
          const data = result.json;
          sendResponse({ nodeUrl: data.url ?? nodeUrl, regionMissing: data.matched === "fallback" });
        } else if (result.ok && result.body) {
          try {
            const data = JSON.parse(result.body);
            sendResponse({ nodeUrl: data.url ?? nodeUrl, regionMissing: data.matched === "fallback" });
          } catch {
            sendResponse({ nodeUrl, regionMissing: false });
          }
        } else {
          sendResponse({ nodeUrl, regionMissing: false });
        }
      } catch {
        sendResponse({ nodeUrl, regionMissing: false });
      }
    });
    return true;
  }
});
