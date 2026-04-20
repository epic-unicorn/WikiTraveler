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
    // Given { lat, lon }, ask the registry for the best node.
    // Falls back to the stored nodeUrl if registry is not configured or fails.
    chrome.storage.sync.get({ nodeUrl: "http://localhost:3000", registryUrl: "" }, async (items) => {
      const { nodeUrl, registryUrl } = items;
      if (!registryUrl || msg.lat == null || msg.lon == null) {
        sendResponse({ nodeUrl });
        return;
      }
      try {
        const res = await fetch(
          `${registryUrl}/api/v1/resolve?lat=${encodeURIComponent(msg.lat)}&lon=${encodeURIComponent(msg.lon)}`,
          { signal: AbortSignal.timeout(4000) }
        );
        if (res.ok) {
          const data = await res.json();
          sendResponse({ nodeUrl: data.url ?? nodeUrl, regionMissing: data.matched === false });
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
