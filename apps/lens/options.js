// options.js

const input = document.getElementById("nodeUrl");
const autoPopupCheckbox = document.getElementById("autoPopup");
const status = document.getElementById("status");
const authStatus = document.getElementById("auth-status");
const loginBox = document.getElementById("login-box");
const loggedInBox = document.getElementById("logged-in-box");

// ── Node settings ──────────────────────────────────────────────────────────

chrome.storage.sync.get({ nodeUrl: "http://localhost:3000", autoPopup: true, wtUsername: "" }, (items) => {
  input.value = items.nodeUrl;
  autoPopupCheckbox.checked = items.autoPopup;
  renderAuthState(items.wtUsername);
});

document.getElementById("save").addEventListener("click", () => {
  const url = input.value.trim().replace(/\/$/, "");
  if (!url) { status.textContent = "URL cannot be empty."; status.style.color = "#ef4444"; return; }
  try { new URL(url); } catch { status.textContent = "Invalid URL."; status.style.color = "#ef4444"; return; }

  chrome.storage.sync.set({ nodeUrl: url, autoPopup: autoPopupCheckbox.checked }, () => {
    status.style.color = "#059669";
    status.textContent = "\u2705 Saved!";
    setTimeout(() => { status.textContent = ""; }, 2500);
  });
});

// ── Auth ───────────────────────────────────────────────────────────────────

function renderAuthState(username) {
  if (username) {
    loggedInBox.style.display = "block";
    document.getElementById("logged-in-user").textContent = username;
    loginBox.style.display = "none";
  } else {
    loggedInBox.style.display = "none";
    loginBox.style.display = "block";
  }
}

async function doAuth(mode) {
  authStatus.textContent = "";
  authStatus.style.color = "#374151";
  const nodeUrl = input.value.trim().replace(/\/$/, "") || "http://localhost:3000";
  const username = document.getElementById("username").value.trim().toLowerCase();
  const password = document.getElementById("password").value;
  if (!username || !password) { authStatus.textContent = "Enter username and password."; authStatus.style.color = "#ef4444"; return; }

  try {
    if (mode === "register") {
      const regRes = await fetch(`${nodeUrl}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const regData = await regRes.json();
      if (!regRes.ok) { authStatus.textContent = regData.message ?? "Registration failed."; authStatus.style.color = "#ef4444"; return; }
    }

    const res = await fetch(`${nodeUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) { authStatus.textContent = data.message ?? "Login failed."; authStatus.style.color = "#ef4444"; return; }

    chrome.storage.sync.set({ wtToken: data.token, wtUsername: data.username ?? username, nodeUrl }, () => {
      renderAuthState(data.username ?? username);
      authStatus.style.color = "#059669";
      authStatus.textContent = mode === "register" ? "\u2705 Account created and logged in!" : "\u2705 Logged in!";
    });
  } catch {
    authStatus.textContent = "Could not reach the node.";
    authStatus.style.color = "#ef4444";
  }
}

document.getElementById("login").addEventListener("click", () => doAuth("login"));
document.getElementById("register").addEventListener("click", () => doAuth("register"));

document.getElementById("logout").addEventListener("click", () => {
  chrome.storage.sync.remove(["wtToken", "wtUsername"], () => {
    renderAuthState("");
    authStatus.style.color = "#059669";
    authStatus.textContent = "Logged out.";
    setTimeout(() => { authStatus.textContent = ""; }, 2000);
  });
});

// Submit on Enter in password field
document.getElementById("password")?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") doAuth("login");
});
