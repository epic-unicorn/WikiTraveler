// background.js — service worker

// ── Extension icon ────────────────────────────────────────────────────────────
// Draw the WikiTraveler LogoMark (hexagon + chevron + bar) in white on brand
// blue onto OffscreenCanvas, then set it as the action icon for all sizes.

function drawLogoMark(ctx, size) {
  const s = size / 32;

  // Brand-blue background
  ctx.fillStyle = "#1e3a8a";
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

// ── Message handling ──────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "GET_NODE_URL") {
    chrome.storage.sync.get({ nodeUrl: "http://localhost:3000" }, (items) => {
      sendResponse({ nodeUrl: items.nodeUrl });
    });
    return true; // keep channel open for async response
  }

  if (msg.type === "RESOLVE_NODE") {
    // Given { lat, lon }, ask this node's /api/peers/resolve for the best regional node.
    // Falls back to the stored nodeUrl if the call fails or no coordinates given.
    chrome.storage.sync.get({ nodeUrl: "http://localhost:3000", wtToken: null }, async (items) => {
      const { nodeUrl, wtToken } = items;
      if (msg.lat == null || msg.lon == null) {
        sendResponse({ nodeUrl, regionMissing: false });
        return;
      }
      const headers = wtToken ? { Authorization: `Bearer ${wtToken}` } : {};
      try {
        const res = await fetch(
          `${nodeUrl}/api/peers/resolve?lat=${encodeURIComponent(msg.lat)}&lon=${encodeURIComponent(msg.lon)}`,
          { signal: AbortSignal.timeout(4000), headers }
        );
        if (res.ok) {
          const data = await res.json();
          sendResponse({ nodeUrl: data.url ?? nodeUrl, regionMissing: data.matched === "fallback" });
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
