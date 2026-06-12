// options.js

const input = document.getElementById("nodeUrl");
const status = document.getElementById("status");
const loginFields = document.getElementById("login-fields");
const loggedInBox = document.getElementById("logged-in-box");
const loginBtn = document.getElementById("login");
const registerBtn = document.getElementById("register");
const logoutBtn = document.getElementById("logout");
const saveBtn = document.getElementById("save");
const nodeStatusEl = document.getElementById("node-status");

let healthCheckTimer = null;
let healthCheckSeq = 0;

function getNodeUrl() {
  return input.value.trim().replace(/\/$/, "");
}

function setStatus(message, color = "#334155") {
  status.style.color = color;
  status.textContent = message;
}

function clearStatusSoon(delay = 2500) {
  setTimeout(() => { status.textContent = ""; }, delay);
}

function validateNodeUrl(url) {
  if (!url) {
    setStatus("Node URL cannot be empty.", "#dc2626");
    return false;
  }
  try {
    new URL(url);
    return true;
  } catch {
    setStatus("Invalid node URL — must start with http:// or https://", "#dc2626");
    return false;
  }
}

async function refreshNodeStatus(url = getNodeUrl()) {
  const seq = ++healthCheckSeq;
  setNodeStatusChecking(nodeStatusEl);
  const result = await checkNodeHealth(url);
  if (seq !== healthCheckSeq) return result;
  applyNodeStatusEl(nodeStatusEl, result);
  return result;
}

function scheduleNodeStatusCheck() {
  clearTimeout(healthCheckTimer);
  healthCheckTimer = setTimeout(() => refreshNodeStatus(), 450);
}

function renderAuthState(username) {
  const signedIn = Boolean(username);
  loggedInBox.style.display = signedIn ? "block" : "none";
  loginFields.style.display = signedIn ? "none" : "block";
  loginBtn.style.display = signedIn ? "none" : "inline-block";
  registerBtn.style.display = signedIn ? "none" : "inline-block";
  logoutBtn.style.display = signedIn ? "inline-block" : "none";
  if (signedIn) {
    document.getElementById("logged-in-user").textContent = username;
  }
}

chrome.storage.sync.get({ nodeUrl: "http://localhost:3000", wtUsername: "" }, (items) => {
  input.value = items.nodeUrl;
  renderAuthState(items.wtUsername);
  refreshNodeStatus(items.nodeUrl);
});

saveBtn.addEventListener("click", async () => {
  const url = getNodeUrl();
  if (!validateNodeUrl(url)) {
    refreshNodeStatus(url);
    return;
  }

  chrome.storage.sync.set({ nodeUrl: url }, async () => {
    const result = await refreshNodeStatus(url);
    if (result.state === "online") {
      setStatus("✅ Node URL saved and reachable.", "#059669");
    } else {
      setStatus("✅ Node URL saved — but the node is not reachable right now.", "#854d0e");
    }
    clearStatusSoon(3500);
  });
});

async function doAuth(mode) {
  const nodeUrl = getNodeUrl() || "http://localhost:3000";
  if (!validateNodeUrl(nodeUrl)) {
    refreshNodeStatus(nodeUrl);
    return;
  }

  const health = await refreshNodeStatus(nodeUrl);
  if (health.state !== "online") {
    setStatus("Cannot sign in — node is not reachable.", "#dc2626");
    return;
  }

  const username = document.getElementById("username").value.trim().toLowerCase();
  const password = document.getElementById("password").value;
  if (!username || !password) {
    setStatus("Enter username and password.", "#dc2626");
    return;
  }

  loginBtn.disabled = true;
  registerBtn.disabled = true;

  try {
    if (mode === "register") {
      const regRes = await fetch(`${nodeUrl}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const regData = await regRes.json();
      if (!regRes.ok) {
        setStatus(regData.message ?? "Registration failed.", "#dc2626");
        return;
      }
    }

    const res = await fetch(`${nodeUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      setStatus(data.message ?? "Login failed.", "#dc2626");
      return;
    }

    chrome.storage.sync.set(
      { wtToken: data.token, wtUsername: data.username ?? username, nodeUrl },
      () => {
        renderAuthState(data.username ?? username);
        document.getElementById("password").value = "";
        setStatus(
          mode === "register" ? "✅ Account created and signed in." : "✅ Signed in.",
          "#059669"
        );
      }
    );
  } catch {
    setStatus("Could not reach the node. Check the URL and try again.", "#dc2626");
  } finally {
    loginBtn.disabled = false;
    registerBtn.disabled = false;
  }
}

loginBtn.addEventListener("click", () => doAuth("login"));
registerBtn.addEventListener("click", () => doAuth("register"));

logoutBtn.addEventListener("click", () => {
  chrome.storage.sync.remove(["wtToken", "wtUsername"], () => {
    renderAuthState("");
    setStatus("Signed out.", "#059669");
    clearStatusSoon(2000);
  });
});

document.getElementById("password")?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") doAuth("login");
});

input.addEventListener("input", scheduleNodeStatusCheck);
input.addEventListener("keydown", (e) => {
  if (e.key === "Enter") saveBtn.click();
});
