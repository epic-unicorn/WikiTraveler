// background.js — service worker
// Handles messages from the content script and options page

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
    return true; // keep channel open for async response
  }
});
