// options.js

const input = document.getElementById("nodeUrl");
const autoPopupCheckbox = document.getElementById("autoPopup");
const status = document.getElementById("status");

// Load saved values
chrome.storage.sync.get({ nodeUrl: "http://localhost:3000", autoPopup: true }, (items) => {
  input.value = items.nodeUrl;
  autoPopupCheckbox.checked = items.autoPopup;
});

document.getElementById("save").addEventListener("click", () => {
  const url = input.value.trim().replace(/\/$/, "");
  if (!url) { status.textContent = "URL cannot be empty."; status.style.color = "#ef4444"; return; }
  try { new URL(url); } catch { status.textContent = "Invalid URL."; status.style.color = "#ef4444"; return; }

  chrome.storage.sync.set({ nodeUrl: url, autoPopup: autoPopupCheckbox.checked }, () => {
    status.style.color = "#059669";
    status.textContent = "✅ Saved!";
    setTimeout(() => { status.textContent = ""; }, 2500);
  });
});
