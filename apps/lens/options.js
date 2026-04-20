// options.js

const input = document.getElementById("nodeUrl");
const registryInput = document.getElementById("registryUrl");
const autoPopupCheckbox = document.getElementById("autoPopup");
const status = document.getElementById("status");

// Load saved values
chrome.storage.sync.get({ nodeUrl: "http://localhost:3000", registryUrl: "", autoPopup: true }, (items) => {
  input.value = items.nodeUrl;
  registryInput.value = items.registryUrl;
  autoPopupCheckbox.checked = items.autoPopup;
});

document.getElementById("save").addEventListener("click", () => {
  const url = input.value.trim().replace(/\/$/, "");
  if (!url) { status.textContent = "URL cannot be empty."; status.style.color = "#ef4444"; return; }
  try { new URL(url); } catch { status.textContent = "Invalid URL."; status.style.color = "#ef4444"; return; }

  const regUrl = registryInput.value.trim().replace(/\/$/, "");
  if (regUrl) {
    try { new URL(regUrl); } catch { status.textContent = "Invalid Registry URL."; status.style.color = "#ef4444"; return; }
  }

  chrome.storage.sync.set({ nodeUrl: url, registryUrl: regUrl, autoPopup: autoPopupCheckbox.checked }, () => {
    status.style.color = "#059669";
    status.textContent = "✅ Saved!";
    setTimeout(() => { status.textContent = ""; }, 2500);
  });
});
