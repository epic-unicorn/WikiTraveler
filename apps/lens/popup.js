// popup.js

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const TIER_LABELS = {
  CONFIRMED: "Confirmed",
  VERIFIED: "Verified",
  AI_GUESS: "AI",
  OFFICIAL: "Official",
};

const TIER_CLASSES = {
  CONFIRMED: "tier--confirmed",
  VERIFIED: "tier--verified",
  AI_GUESS: "tier--ai-guess",
  OFFICIAL: "tier--official",
};

// ─────────────────────────────────────────────────────────────────────────────
// Node status bar
// ─────────────────────────────────────────────────────────────────────────────

async function updateNodeStatusBar(nodeUrl) {
  const bar = document.getElementById("node-status-bar");
  setNodeStatusChecking(bar);
  const result = await checkNodeHealth(nodeUrl);
  applyNodeStatusEl(bar, result);
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Search for a property by name with progressive truncation + coordinate scoring
// ─────────────────────────────────────────────────────────────────────────────

async function searchForProperty(name, nodeUrl, coords, headers = {}) {
  const words = name.split(/\s+/);
  let bestCandidates = null;

  for (let len = words.length; len >= 2; len--) {
    const q = words.slice(0, len).join(" ");
    try {
      const res = await fetch(
        `${nodeUrl}/api/properties?q=${encodeURIComponent(q)}`,
        { signal: AbortSignal.timeout(6000), headers }
      );
      if (!res.ok) continue;
      const data = await res.json();
      const results = data.properties ?? [];
      if (results.length === 0) continue;

      const lower = name.toLowerCase();
      const exact = results.find((p) => p.name.toLowerCase() === lower);
      if (exact) return exact;

      const prefixMatches = results.filter((p) => lower.startsWith(p.name.toLowerCase()));
      if (prefixMatches.length === 1) return prefixMatches[0];

      if (!bestCandidates) bestCandidates = results;
      break;
    } catch {
      // network error — try shorter
    }
  }

  if (!bestCandidates) return null;
  if (bestCandidates.length === 1) return bestCandidates[0];

  if (coords?.lat != null && coords?.lon != null) {
    const scored = bestCandidates
      .filter((p) => p.lat != null && p.lon != null)
      .map((p) => ({ p, dist: Math.hypot(p.lat - coords.lat, p.lon - coords.lon) }))
      .sort((a, b) => a.dist - b.dist);
    if (scored.length > 0 && scored[0].dist < 0.005) return scored[0].p;
  }

  return null;
}

function extractHotelNameFromTab(tab) {
  const title = tab.title ?? "";
  return title
    .replace(/\s*[|\u2013\u2014]\s*(Booking\.com|Expedia|Hotels\.com|Agoda).*$/i, "")
    .replace(/,\s*[A-Z][^,]+.*$/, "")
    .trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// DOM helpers
// ─────────────────────────────────────────────────────────────────────────────

function createTierBadge(tier) {
  const badge = document.createElement("span");
  badge.className = `tier-badge ${TIER_CLASSES[tier] ?? TIER_CLASSES.OFFICIAL}`;
  badge.textContent = TIER_LABELS[tier] ?? tier;
  return badge;
}

function createFactsTable(facts) {
  const table = document.createElement("table");
  table.className = "facts-table";

  facts.forEach((f) => {
    const row = table.insertRow();

    const labelCell = row.insertCell();
    labelCell.className = "fact-label";
    labelCell.textContent = f.fieldName.replace(/_/g, " ");

    const valueCell = row.insertCell();
    valueCell.className = "fact-value-cell";

    const valueText = document.createTextNode(f.value + " ");
    valueCell.appendChild(valueText);
    valueCell.appendChild(createTierBadge(f.tier ?? "OFFICIAL"));
  });

  return table;
}

function createPropertyHeader(prop, displayName) {
  const header = document.createElement("div");
  header.className = "property-header";

  if (prop?.name) {
    const name = document.createElement("p");
    name.className = "property-name";
    name.textContent = prop.name;
    header.appendChild(name);
  } else if (displayName) {
    const name = document.createElement("p");
    name.className = "property-name";
    name.textContent = displayName;
    header.appendChild(name);
  }

  if (prop?.location) {
    const loc = document.createElement("p");
    loc.className = "property-location";
    loc.textContent = prop.location;
    header.appendChild(loc);
  }

  return header;
}

// ─────────────────────────────────────────────────────────────────────────────
// Search section
// ─────────────────────────────────────────────────────────────────────────────

function initSearchSection(nodeUrl, authHeaders, onSelect) {
  const section = document.getElementById("search-section");
  const input = document.getElementById("search-input");
  const results = document.getElementById("search-results");

  section.style.display = "block";

  // Clear previous listeners by replacing the input
  const freshInput = input.cloneNode(true);
  input.parentNode.replaceChild(freshInput, input);

  let searchTimer;
  freshInput.addEventListener("input", () => {
    clearTimeout(searchTimer);
    const q = freshInput.value.trim();
    results.innerHTML = "";

    if (q.length < 2) return;

    searchTimer = setTimeout(async () => {
      try {
        const res = await fetch(
          `${nodeUrl}/api/properties?q=${encodeURIComponent(q)}`,
          { signal: AbortSignal.timeout(6000), headers: authHeaders }
        );
        if (!res.ok) return;
        const data = await res.json();
        const properties = data.properties ?? [];

        results.innerHTML = "";

        if (properties.length === 0) {
          const empty = document.createElement("p");
          empty.className = "search-empty";
          empty.textContent = "No results found";
          results.appendChild(empty);
          return;
        }

        properties.slice(0, 8).forEach((prop) => {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "search-result-btn";

          const nameEl = document.createElement("span");
          nameEl.className = "search-result-name";
          nameEl.textContent = prop.name;

          const locEl = document.createElement("span");
          locEl.className = "search-result-loc";
          locEl.textContent = prop.location ?? "";

          btn.appendChild(nameEl);
          btn.appendChild(locEl);
          btn.addEventListener("click", () => {
            section.style.display = "none";
            document.getElementById("search-toggle-bar").style.display = "none";
            onSelect(prop.id, prop.name);
          });

          results.appendChild(btn);
        });
      } catch {
        // silent — network or abort
      }
    }, 350);
  });
}

function showSearchToggle(nodeUrl, authHeaders, onSelect) {
  const bar = document.getElementById("search-toggle-bar");
  const btn = document.getElementById("search-toggle-btn");
  bar.style.display = "block";

  let open = false;

  const newBtn = btn.cloneNode(true);
  btn.parentNode.replaceChild(newBtn, btn);

  newBtn.addEventListener("click", () => {
    open = !open;
    if (open) {
      newBtn.textContent = "✕ Close search";
      initSearchSection(nodeUrl, authHeaders, onSelect);
    } else {
      newBtn.textContent = "🔍 Search for different property";
      document.getElementById("search-section").style.display = "none";
      document.getElementById("search-results").innerHTML = "";
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Login form
// ─────────────────────────────────────────────────────────────────────────────

function showLoginForm(content, nodeUrl = "http://localhost:3000", nodeHealth = null) {
  hideSearchUI();

  const offlineMsg =
    nodeHealth?.state === "offline"
      ? `<p style="color:#dc2626;font-size:12px;margin-bottom:10px">Node is unreachable. Update the URL in <a href="#" id="wt-settings-link" style="color:#1d4ed8">settings</a>.</p>`
      : "";

  content.innerHTML = `
    <div style="padding:2px 0">
      ${offlineMsg}
      <p style="font-size:13px;color:#334155;margin-bottom:12px;font-weight:600">Sign in to your node</p>
      <input id="wt-login-username" type="text" placeholder="Username" class="login-input" autocomplete="username">
      <input id="wt-login-password" type="password" placeholder="Password" class="login-input" autocomplete="current-password">
      <button id="wt-login-btn" class="login-btn">Sign in</button>
      <p id="wt-login-error" class="login-error"></p>
      <p class="login-footer">No account? <a id="wt-register-link" href="#">Register on node →</a></p>
    </div>
  `;

  document.getElementById("wt-settings-link")?.addEventListener("click", (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });

  chrome.storage.sync.get({ nodeUrl }, (items) => {
    document.getElementById("wt-register-link")?.addEventListener("click", (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: `${items.nodeUrl}/register` });
    });

    document.getElementById("wt-login-btn").addEventListener("click", async () => {
      const username = document.getElementById("wt-login-username").value.trim();
      const password = document.getElementById("wt-login-password").value;
      const errEl = document.getElementById("wt-login-error");
      errEl.style.display = "none";

      if (!username || !password) {
        errEl.textContent = "Username and password are required.";
        errEl.style.display = "block";
        return;
      }

      const btn = document.getElementById("wt-login-btn");
      btn.disabled = true;
      btn.textContent = "Signing in…";

      try {
        const res = await fetch(`${items.nodeUrl}/api/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password }),
          signal: AbortSignal.timeout(8000),
        });
        const data = await res.json();
        if (!res.ok) {
          errEl.textContent = data.message ?? "Login failed.";
          errEl.style.display = "block";
          btn.disabled = false;
          btn.textContent = "Sign in";
          return;
        }
        await new Promise((resolve) =>
          chrome.storage.sync.set({ wtToken: data.token, wtUsername: username }, resolve)
        );
        init();
      } catch {
        errEl.textContent = "Could not reach node.";
        errEl.style.display = "block";
        btn.disabled = false;
        btn.textContent = "Sign in";
      }
    });

    document.getElementById("wt-login-password").addEventListener("keydown", (e) => {
      if (e.key === "Enter") document.getElementById("wt-login-btn").click();
    });
  });
}

function hideSearchUI() {
  document.getElementById("search-section").style.display = "none";
  document.getElementById("search-toggle-bar").style.display = "none";
  document.getElementById("search-results").innerHTML = "";
}

// ─────────────────────────────────────────────────────────────────────────────
// Fetch and render property facts
// ─────────────────────────────────────────────────────────────────────────────

async function fetchAndRender(resolvedId, displayName, content, nodeUrl, authHeaders, tab) {
  const res = await fetch(
    `${nodeUrl}/api/properties/${encodeURIComponent(resolvedId)}/accessibility`,
    { signal: AbortSignal.timeout(6000), headers: authHeaders }
  );

  if (res.status === 401 || res.status === 403) {
    await new Promise((resolve) => chrome.storage.sync.remove(["wtToken"], resolve));
    showLoginForm(content, nodeUrl);
    return;
  }

  if (res.status === 404) {
    // Name-search fallback using tab title
    if (tab) {
      const name = extractHotelNameFromTab(tab);
      if (name) {
        const match = await searchForProperty(name, nodeUrl, null, authHeaders);
        if (match) {
          return fetchAndRender(match.id, match.name, content, nodeUrl, authHeaders, null);
        }
      }
    }
    renderNotFound(content, nodeUrl, authHeaders, displayName);
    return;
  }

  if (!res.ok) {
    renderNotFound(content, nodeUrl, authHeaders, displayName);
    return;
  }

  const data = await res.json();
  const facts = data.facts ?? [];
  const prop = data.property;

  content.innerHTML = "";
  content.appendChild(createPropertyHeader(prop, displayName));

  if (facts.length === 0) {
    const empty = document.createElement("div");
    empty.className = "state-empty";
    empty.style.paddingTop = "8px";
    empty.innerHTML = `<p>No accessibility facts yet.<br>Use the Field Kit to submit an audit.</p>`;
    content.appendChild(empty);
  } else {
    content.appendChild(createFactsTable(facts));
  }

  // Show search toggle below facts
  showSearchToggle(nodeUrl, authHeaders, (id, name) => {
    content.innerHTML = `<p style="color:#94a3b8;font-size:13px;padding:8px 0">Loading…</p>`;
    fetchAndRender(id, name, content, nodeUrl, authHeaders, null);
  });
}

function renderNotFound(content, nodeUrl, authHeaders, displayName) {
  content.innerHTML = "";

  const empty = document.createElement("div");
  empty.className = "state-empty";

  const icon = document.createElement("div");
  icon.className = "state-icon";
  icon.textContent = "🏨";
  empty.appendChild(icon);

  const msg = document.createElement("p");
  msg.textContent = displayName
    ? `No data found for "${displayName}".`
    : "No data found for this property.";
  empty.appendChild(msg);

  content.appendChild(empty);

  // Show search section expanded
  initSearchSection(nodeUrl, authHeaders, (id, name) => {
    content.innerHTML = `<p style="color:#94a3b8;font-size:13px;padding:8px 0">Loading…</p>`;
    fetchAndRender(id, name, content, nodeUrl, authHeaders, null);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Initialise popup
// ─────────────────────────────────────────────────────────────────────────────

async function init() {
  const content = document.getElementById("content");
  hideSearchUI();

  content.innerHTML = `<p style="color:#94a3b8;font-size:13px">Loading…</p>`;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tab?.url ?? "";

  const { wtToken, wtUsername: storedUsername, nodeUrl: storedNodeUrl } =
    await new Promise((resolve) =>
      chrome.storage.sync.get(
        { wtToken: null, wtUsername: "", nodeUrl: "http://localhost:3000" },
        resolve
      )
    );

  const nodeHealth = await updateNodeStatusBar(storedNodeUrl);

  // Header: username + sign-out button
  const userLine = document.getElementById("user-line");
  const signOutBtn = document.getElementById("wt-signout");

  if (storedUsername) {
    try {
      const host = new URL(storedNodeUrl).hostname;
      if (userLine) userLine.textContent = `${storedUsername}@${host}`;
    } catch { /* invalid URL */ }
  } else {
    if (userLine) userLine.textContent = "";
  }

  if (wtToken && signOutBtn) {
    signOutBtn.style.display = "block";
    // Use a one-time handler to avoid stacking listeners across init() calls
    signOutBtn.onclick = async () => {
      await new Promise((resolve) =>
        chrome.storage.sync.remove(["wtToken", "wtUsername"], resolve)
      );
      signOutBtn.style.display = "none";
      if (userLine) userLine.textContent = "";
      showLoginForm(content, storedNodeUrl, nodeHealth);
    };
  } else if (signOutBtn) {
    signOutBtn.style.display = "none";
    signOutBtn.onclick = null;
  }

  if (!wtToken) {
    showLoginForm(content, storedNodeUrl, nodeHealth);
    return;
  }

  // Get coordinates from content script
  let coords = null;
  try {
    const coordRes = await chrome.tabs.sendMessage(tab.id, { type: "GET_COORDS" });
    if (coordRes?.lat != null && coordRes?.lon != null) coords = coordRes;
  } catch { /* content script not on this page */ }

  // Resolve best regional node via peers
  const { nodeUrl, regionMissing } = await new Promise((resolve) =>
    chrome.runtime.sendMessage(
      { type: "RESOLVE_NODE", lat: coords?.lat ?? null, lon: coords?.lon ?? null },
      (res) => resolve(res ?? { nodeUrl: storedNodeUrl, regionMissing: false })
    )
  );

  // Regional fallback warning
  if (regionMissing && coords != null) {
    const banner = document.createElement("div");
    banner.className = "warning-banner";
    banner.innerHTML = `<span aria-hidden="true">⚠️</span><span>No regional node for this location — data may be from another region.</span>`;
    document.getElementById("node-status-bar").after(banner);
  }

  // Extract property ID via content script
  let propertyId = "unknown";
  try {
    const response = await chrome.tabs.sendMessage(tab.id, { type: "GET_PROPERTY_ID" });
    if (response?.propertyId) propertyId = response.propertyId;
  } catch {
    const params = (() => { try { return new URLSearchParams(new URL(url).search); } catch { return new URLSearchParams(); } })();
    const bookingQuery = params.get("hotelid");
    if (bookingQuery) propertyId = `booking-${bookingQuery}`;
    else {
      const bookingPath = url.match(/booking\.com\/hotel\/[^/]+\/([^.?#]+)/);
      if (bookingPath) propertyId = `booking-${bookingPath[1]}`;
      const expediaMatch = url.match(/\/h(\d+)\.Hotel/i);
      if (expediaMatch) propertyId = `expedia-${expediaMatch[1]}`;
    }
  }

  content.innerHTML = `<p style="color:#94a3b8;font-size:13px">Fetching from <code>${nodeUrl}</code>…</p>`;

  const authHeaders = { Authorization: `Bearer ${wtToken}` };

  try {
    await fetchAndRender(propertyId, null, content, nodeUrl, authHeaders, tab);
  } catch {
    content.innerHTML = "";
    const empty = document.createElement("div");
    empty.className = "state-empty";
    empty.innerHTML = `<div class="state-icon">⚡</div><p>Could not reach node.<br><a href="#" id="wt-settings-link2">Check settings →</a></p>`;
    content.appendChild(empty);
    document.getElementById("wt-settings-link2")?.addEventListener("click", (e) => {
      e.preventDefault();
      chrome.runtime.openOptionsPage();
    });
    initSearchSection(nodeUrl, authHeaders, (id, name) => {
      content.innerHTML = `<p style="color:#94a3b8;font-size:13px;padding:8px 0">Loading…</p>`;
      fetchAndRender(id, name, content, nodeUrl, authHeaders, null);
    });
  }
}

init();
