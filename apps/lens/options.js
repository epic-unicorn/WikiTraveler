// options.js

const input = document.getElementById("nodeUrl");
const localeSelect = document.getElementById("locale");
const status = document.getElementById("status");
const loginFields = document.getElementById("login-fields");
const loggedInBox = document.getElementById("logged-in-box");
const loginBtn = document.getElementById("login");
const registerBtn = document.getElementById("register");
const logoutBtn = document.getElementById("logout");
const saveBtn = document.getElementById("save");
const nodeStatusEl = document.getElementById("node-status");

let currentLocale = "en";
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
    setStatus(wtT("ui.lensUrlEmpty", currentLocale), "#dc2626");
    return false;
  }
  try {
    new URL(url);
    return true;
  } catch {
    setStatus(wtT("ui.lensUrlInvalid", currentLocale), "#dc2626");
    return false;
  }
}

async function refreshNodeStatus(url = getNodeUrl()) {
  const seq = ++healthCheckSeq;
  setNodeStatusChecking(nodeStatusEl, currentLocale);
  const result = await checkNodeHealth(url, currentLocale);
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

function applyOptionsStaticLabels(locale) {
  document.documentElement.lang = locale;
  document.querySelector(".header-sub").textContent = wtT("ui.tabSettings", locale);
  document.querySelector(".subtitle").textContent = wtT("ui.lensSettingsSubtitle", locale);
  document.querySelectorAll(".section-label")[0].textContent = wtT("ui.settingsNodeConnection", locale);
  document.querySelector("label[for='nodeUrl']").textContent = wtT("ui.settingsHomeNodeUrl", locale);
  document.querySelector(".hint").textContent = wtT("ui.lensNodeUrlHint", locale);
  document.querySelectorAll(".section-label")[1].textContent = wtT("ui.settingsLanguage", locale);
  document.querySelector("label[for='locale']").textContent = wtT("ui.language", locale);
  document.querySelectorAll(".section-label")[2].textContent = wtT("ui.settingsAccount", locale);
  document.querySelector("#logged-in-box .hint").textContent = wtT("ui.lensTokenSyncHint", locale);
  document.querySelector("label[for='username']").textContent = wtT("ui.username", locale);
  document.querySelector("label[for='password']").textContent = wtT("ui.password", locale);
  saveBtn.textContent = wtT("ui.lensSaveUrl", locale);
  loginBtn.textContent = wtT("ui.signIn", locale);
  registerBtn.textContent = wtT("ui.authCreateAccount", locale);
  logoutBtn.textContent = wtT("ui.signOut", locale);
}

async function bootstrap() {
  currentLocale = await wtGetLocale();
  wtApplyLocaleSelect(localeSelect, currentLocale);
  applyOptionsStaticLabels(currentLocale);

  const localeKey = WtI18n.LOCALE_STORAGE_KEY;
  chrome.storage.sync.get(
    { nodeUrl: "http://localhost:3000", wtUsername: "", [localeKey]: WtI18n.DEFAULT_LOCALE },
    (items) => {
      input.value = items.nodeUrl;
      renderAuthState(items.wtUsername);
      refreshNodeStatus(items.nodeUrl);
    }
  );
}

localeSelect.addEventListener("change", async () => {
  currentLocale = localeSelect.value;
  await wtSetLocale(currentLocale);
  applyOptionsStaticLabels(currentLocale);
  await refreshNodeStatus();
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
      setStatus(wtT("ui.lensUrlSavedOk", currentLocale), "#059669");
    } else {
      setStatus(wtT("ui.lensUrlSavedOffline", currentLocale), "#854d0e");
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
    setStatus(wtT("ui.lensCannotSignInOffline", currentLocale), "#dc2626");
    return;
  }

  const username = document.getElementById("username").value.trim().toLowerCase();
  const password = document.getElementById("password").value;
  if (!username || !password) {
    setStatus(wtT("ui.lensEnterCredentials", currentLocale), "#dc2626");
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
        setStatus(regData.message ?? wtT("ui.authLoginFailed", currentLocale), "#dc2626");
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
      setStatus(data.message ?? wtT("ui.authLoginFailed", currentLocale), "#dc2626");
      return;
    }

    chrome.storage.sync.set(
      { wtToken: data.token, wtUsername: data.username ?? username, nodeUrl },
      () => {
        renderAuthState(data.username ?? username);
        document.getElementById("password").value = "";
        setStatus(
          mode === "register"
            ? wtT("ui.lensAccountCreatedSignedIn", currentLocale)
            : wtT("ui.lensSignedInOk", currentLocale),
          "#059669"
        );
      }
    );
  } catch {
    setStatus(wtT("ui.lensReachNodeFailed", currentLocale), "#dc2626");
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
    setStatus(wtT("ui.signOut", currentLocale), "#059669");
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

bootstrap();
