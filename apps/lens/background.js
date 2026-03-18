// background.js — service worker
// Handles messages from the content script and options page

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "GET_NODE_URL") {
    chrome.storage.sync.get({ nodeUrl: "http://localhost:3000" }, (items) => {
      sendResponse({ nodeUrl: items.nodeUrl });
    });
    return true; // keep channel open for async response
  }
});
