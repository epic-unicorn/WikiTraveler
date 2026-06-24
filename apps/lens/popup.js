// popup.js

const TIER_CLASSES = {
  CONFIRMED: "tier--confirmed",
  VERIFIED: "tier--verified",
  AI_GUESS: "tier--ai-guess",
  OFFICIAL: "tier--official",
};

const CONFIDENCE_ONLY = new Set(["high", "medium", "low"]);

let currentLocale = "en";

// ─────────────────────────────────────────────────────────────────────────────
// Node status bar
// ─────────────────────────────────────────────────────────────────────────────

async function updateNodeStatusBar(nodeUrl, locale) {
  const bar = document.getElementById("node-status-bar");
  setNodeStatusChecking(bar, locale);
  const result = await checkNodeHealth(nodeUrl, locale);
  applyNodeStatusEl(bar, result);
  return result;
}

function applyPopupStaticLabels(locale) {
  document.documentElement.lang = locale;
  const signOut = document.getElementById("wt-signout");
  if (signOut) {
    signOut.title = wtT("ui.signOut", locale);
    signOut.textContent = wtT("ui.signOut", locale);
  }
  const searchLabel = document.querySelector(".search-label");
  if (searchLabel) searchLabel.textContent = wtT("ui.searchProperties", locale);
  const searchInput = document.getElementById("search-input");
  if (searchInput) searchInput.placeholder = wtT("ui.searchPlaceholder", locale);
  const loadingEl = document.querySelector("#content > p");
  if (loadingEl?.textContent === "Loading…" || loadingEl?.dataset?.wtLoading) {
    loadingEl.textContent = wtT("ui.loading", locale);
    loadingEl.dataset.wtLoading = "1";
  }
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

function createTierBadge(tier, locale) {
  const badge = document.createElement("span");
  badge.className = `tier-badge ${TIER_CLASSES[tier] ?? TIER_CLASSES.OFFICIAL}`;
  badge.textContent = wtTierLabel(tier, locale);
  return badge;
}

function parseAiMeta(signatureHash) {
  if (!signatureHash) return null;
  try {
    const parsed = JSON.parse(signatureHash);
    if (typeof parsed !== "object" || parsed === null) return null;
    return parsed;
  } catch {
    return null;
  }
}

function resolveFactDisplay(fact, locale) {
  const tier = fact.tier ?? "OFFICIAL";
  const meta = tier === "AI_GUESS" ? parseAiMeta(fact.signatureHash) : null;
  const rawValue = String(fact.value ?? "").trim();
  const confidence =
    typeof meta?.confidence === "string" ? meta.confidence.toLowerCase() : null;
  const evidence = typeof meta?.evidence === "string" ? meta.evidence.trim() : "";

  let displayValue = rawValue;
  if (
    tier === "AI_GUESS" &&
    CONFIDENCE_ONLY.has(rawValue.toLowerCase()) &&
    evidence
  ) {
    displayValue = evidence;
  } else if (
    tier === "AI_GUESS" &&
    CONFIDENCE_ONLY.has(rawValue.toLowerCase())
  ) {
    displayValue = wtT("ui.estimateUnavailable", locale);
  }

  return { tier, displayValue, confidence, evidence, rawValue };
}

function appendFactBadges(container, tier, confidence, locale) {
  const badges = document.createElement("span");
  badges.className = "fact-badges";
  badges.appendChild(createTierBadge(tier, locale));
  if (tier === "AI_GUESS" && confidence) {
    const conf = document.createElement("span");
    conf.className = "confidence-badge";
    conf.textContent = confidence;
    badges.appendChild(conf);
  }
  container.appendChild(badges);
}

function createFactsTable(facts, locale) {
  const table = document.createElement("table");
  table.className = "facts-table";

  const thead = table.createTHead();
  const headerRow = thead.insertRow();
  [wtT("ui.lensFactFeature", locale), wtT("ui.lensFactValue", locale)].forEach((heading) => {
    const th = document.createElement("th");
    th.scope = "col";
    th.textContent = heading;
    headerRow.appendChild(th);
  });

  facts.forEach((f) => {
    const { tier, displayValue, confidence, evidence, rawValue } = resolveFactDisplay(f, locale);
    const label = wtFieldLabel(f.fieldName, locale);
    const useStackedLayout =
      f.fieldName === "notes" || displayValue.length > 48;

    const row = table.insertRow();
    if (useStackedLayout) {
      row.className = "fact-row--stacked";
      const cell = row.insertCell();
      cell.colSpan = 2;

      const labelEl = document.createElement("div");
      labelEl.className = "fact-stacked-label";
      labelEl.appendChild(document.createTextNode(label));
      appendFactBadges(labelEl, tier, confidence, locale);
      cell.appendChild(labelEl);

      const valueEl = document.createElement("div");
      valueEl.className = "fact-stacked-value";
      valueEl.textContent = displayValue;
      cell.appendChild(valueEl);

      if (
        tier === "AI_GUESS" &&
        evidence &&
        evidence !== displayValue &&
        !CONFIDENCE_ONLY.has(rawValue.toLowerCase())
      ) {
        const evidenceEl = document.createElement("div");
        evidenceEl.className = "fact-evidence";
        evidenceEl.textContent = evidence;
        cell.appendChild(evidenceEl);
      }
      return;
    }

    const labelCell = row.insertCell();
    labelCell.className = "fact-label";
    labelCell.textContent = label;

    const valueCell = row.insertCell();
    valueCell.className = "fact-value-cell";

    const valueWrap = document.createElement("div");
    valueWrap.textContent = displayValue;
    valueCell.appendChild(valueWrap);

    const badgeWrap = document.createElement("div");
    badgeWrap.style.marginTop = "4px";
    appendFactBadges(badgeWrap, tier, confidence, locale);
    valueCell.appendChild(badgeWrap);
  });

  return table;
}

function auditPhotoUrl(photo) {
  if (typeof photo === "string") return photo;
  if (photo && typeof photo.url === "string") return photo.url;
  return "";
}

function createAuditPhotosSection(auditPhotos, hasAiGuess, locale) {
  if (!auditPhotos?.photos?.length) return null;

  const section = document.createElement("div");
  section.className = "audit-photos";

  const title = document.createElement("p");
  title.className = "audit-photos-title";
  title.textContent = hasAiGuess
    ? wtT("ui.existingDataUsedForAi", locale)
    : wtT("ui.lensAuditPhotos", locale);
  section.appendChild(title);

  const strip = document.createElement("div");
  strip.className = "audit-photos-strip";

  let expandedWrap = null;

  auditPhotos.photos.forEach((photo, i) => {
    const src = auditPhotoUrl(photo);
    if (!src) return;

    const photoLabel = wtT("ui.lensAuditPhoto", locale, { n: i + 1 });
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "audit-photo-btn";
    btn.title = photoLabel;

    const img = document.createElement("img");
    img.className = "audit-photo";
    img.src = src;
    img.alt = photoLabel;
    img.loading = "lazy";

    btn.appendChild(img);
    btn.addEventListener("click", () => {
      const isActive = btn.classList.contains("is-active");
      strip.querySelectorAll(".audit-photo-btn").forEach((el) => el.classList.remove("is-active"));
      if (expandedWrap) {
        expandedWrap.remove();
        expandedWrap = null;
      }
      if (isActive) return;

      btn.classList.add("is-active");
      expandedWrap = document.createElement("div");
      expandedWrap.className = "audit-photo-expanded";

      const big = document.createElement("img");
      big.src = src;
      big.alt = photoLabel;
      expandedWrap.appendChild(big);
      section.appendChild(expandedWrap);
    });

    strip.appendChild(btn);
  });

  section.appendChild(strip);

  if (auditPhotos.capturedAt) {
    const date = document.createElement("p");
    date.className = "audit-photos-date";
    date.textContent = wtT("ui.lensCapturedAt", locale, {
      date: new Date(auditPhotos.capturedAt).toLocaleString(),
    });
    section.appendChild(date);
  }

  return section;
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

function initSearchSection(nodeUrl, authHeaders, locale, onSelect) {
  const section = document.getElementById("search-section");
  const input = document.getElementById("search-input");
  const results = document.getElementById("search-results");

  section.style.display = "block";

  const freshInput = input.cloneNode(true);
  freshInput.placeholder = wtT("ui.searchPlaceholder", locale);
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
          empty.textContent = wtT("ui.searchNoResults", locale);
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

function showSearchToggle(nodeUrl, authHeaders, locale, onSelect) {
  const bar = document.getElementById("search-toggle-bar");
  const btn = document.getElementById("search-toggle-btn");
  bar.style.display = "block";

  let open = false;

  const newBtn = btn.cloneNode(true);
  btn.parentNode.replaceChild(newBtn, btn);

  newBtn.setAttribute("aria-expanded", "false");
  newBtn.setAttribute("aria-controls", "search-section");
  newBtn.textContent = wtT("ui.lensSearchDifferent", locale);

  newBtn.addEventListener("click", () => {
    open = !open;
    newBtn.setAttribute("aria-expanded", open ? "true" : "false");
    if (open) {
      newBtn.textContent = wtT("ui.lensCloseSearch", locale);
      initSearchSection(nodeUrl, authHeaders, locale, onSelect);
    } else {
      newBtn.textContent = wtT("ui.lensSearchDifferent", locale);
      document.getElementById("search-section").style.display = "none";
      document.getElementById("search-results").innerHTML = "";
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Login form
// ─────────────────────────────────────────────────────────────────────────────

function showLoginForm(content, locale, nodeUrl = "http://localhost:3000", nodeHealth = null) {
  hideSearchUI();

  const offlineMsg =
    nodeHealth?.state === "offline"
      ? `<p style="color:#dc2626;font-size:12px;margin-bottom:10px">${wtT("ui.lensNodeOfflineHtml", locale)}</p>`
      : "";

  content.innerHTML = `
    <div style="padding:2px 0">
      ${offlineMsg}
      <p style="font-size:13px;color:#334155;margin-bottom:12px;font-weight:600">${wtT("ui.lensSignInTitle", locale)}</p>
      <label class="wt-sr-only" for="wt-login-username">${wtT("ui.username", locale)}</label>
      <input id="wt-login-username" type="text" placeholder="${wtT("ui.username", locale)}" class="login-input" autocomplete="username">
      <label class="wt-sr-only" for="wt-login-password">${wtT("ui.password", locale)}</label>
      <input id="wt-login-password" type="password" placeholder="${wtT("ui.password", locale)}" class="login-input" autocomplete="current-password">
      <button id="wt-login-btn" class="login-btn">${wtT("ui.signIn", locale)}</button>
      <p id="wt-login-error" class="login-error" role="alert"></p>
      <p class="login-footer">${wtT("ui.lensNoAccount", locale)} <a id="wt-register-link" href="#">${wtT("ui.lensRegisterLink", locale)}</a></p>
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
        errEl.textContent = wtT("ui.lensCredentialsRequired", locale);
        errEl.style.display = "block";
        return;
      }

      const btn = document.getElementById("wt-login-btn");
      btn.disabled = true;
      btn.textContent = wtT("ui.authSigningIn", locale);

      try {
        const res = await fetch(`${items.nodeUrl}/api/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password }),
          signal: AbortSignal.timeout(8000),
        });
        const data = await res.json();
        if (!res.ok) {
          errEl.textContent = data.message ?? wtT("ui.authLoginFailed", locale);
          errEl.style.display = "block";
          btn.disabled = false;
          btn.textContent = wtT("ui.signIn", locale);
          return;
        }
        await new Promise((resolve) =>
          chrome.storage.sync.set({ wtToken: data.token, wtUsername: username }, resolve)
        );
        init();
      } catch {
        errEl.textContent = wtT("ui.authServerUnreachable", locale);
        errEl.style.display = "block";
        btn.disabled = false;
        btn.textContent = wtT("ui.signIn", locale);
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

function showLoading(content, locale, message) {
  content.innerHTML = `<p style="color:#94a3b8;font-size:13px" data-wt-loading="1">${message ?? wtT("ui.loading", locale)}</p>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Fetch and render property facts
// ─────────────────────────────────────────────────────────────────────────────

async function fetchAndRender(resolvedId, displayName, content, nodeUrl, authHeaders, locale, tab) {
  const res = await fetch(
    `${nodeUrl}/api/properties/${encodeURIComponent(resolvedId)}/accessibility`,
    { signal: AbortSignal.timeout(6000), headers: authHeaders }
  );

  if (res.status === 401 || res.status === 403) {
    await new Promise((resolve) => chrome.storage.sync.remove(["wtToken"], resolve));
    showLoginForm(content, locale, nodeUrl);
    return;
  }

  if (res.status === 404) {
    if (tab) {
      const name = extractHotelNameFromTab(tab);
      if (name) {
        const match = await searchForProperty(name, nodeUrl, null, authHeaders);
        if (match) {
          return fetchAndRender(match.id, match.name, content, nodeUrl, authHeaders, locale, null);
        }
      }
    }
    renderNotFound(content, nodeUrl, authHeaders, locale, displayName);
    return;
  }

  if (!res.ok) {
    renderNotFound(content, nodeUrl, authHeaders, locale, displayName);
    return;
  }

  const data = await res.json();
  const facts = data.facts ?? [];
  const prop = data.property;

  content.innerHTML = "";
  content.appendChild(createPropertyHeader(prop, displayName));

  const photosSection = createAuditPhotosSection(data.auditPhotos, data.hasAiGuess, locale);
  if (photosSection) content.appendChild(photosSection);

  if (facts.length === 0) {
    const empty = document.createElement("div");
    empty.className = "state-empty";
    empty.style.paddingTop = "8px";
    const p = document.createElement("p");
    p.textContent = wtT("ui.lensNoFactsHint", locale);
    empty.appendChild(p);
    content.appendChild(empty);
  } else {
    content.appendChild(createFactsTable(facts, locale));
  }

  const reportBar = document.createElement("div");
  reportBar.style.marginTop = "14px";
  reportBar.style.paddingTop = "12px";
  reportBar.style.borderTop = "1px solid #e2e8f0";
  const reportBtn = document.createElement("button");
  reportBtn.type = "button";
  reportBtn.textContent = wtT("ui.lensReportIssue", locale);
  reportBtn.style.cssText = "display:block;width:100%;font-size:13px;font-weight:600;color:#2563eb;background:none;border:none;padding:0;cursor:pointer;text-align:left";
  reportBtn.addEventListener("click", () => {
    alert(wtT("ui.lensReportHint", locale));
  });
  reportBar.appendChild(reportBtn);
  const reportHint = document.createElement("p");
  reportHint.textContent = wtT("ui.lensReportHint", locale);
  reportHint.style.cssText = "font-size:11px;color:#94a3b8;margin:6px 0 0";
  reportBar.appendChild(reportHint);
  content.appendChild(reportBar);

  showSearchToggle(nodeUrl, authHeaders, locale, (id, name) => {
    showLoading(content, locale);
    fetchAndRender(id, name, content, nodeUrl, authHeaders, locale, null);
  });
}

function renderNotFound(content, nodeUrl, authHeaders, locale, displayName) {
  content.innerHTML = "";

  const empty = document.createElement("div");
  empty.className = "state-empty";

  const icon = document.createElement("div");
  icon.className = "state-icon";
  icon.textContent = "🏨";
  empty.appendChild(icon);

  const msg = document.createElement("p");
  msg.textContent = displayName
    ? wtT("ui.lensNoDataFor", locale, { name: displayName })
    : wtT("ui.lensNoDataProperty", locale);
  empty.appendChild(msg);

  content.appendChild(empty);

  initSearchSection(nodeUrl, authHeaders, locale, (id, name) => {
    showLoading(content, locale);
    fetchAndRender(id, name, content, nodeUrl, authHeaders, locale, null);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Initialise popup
// ─────────────────────────────────────────────────────────────────────────────

async function init() {
  currentLocale = await wtGetLocale();
  applyPopupStaticLabels(currentLocale);

  const content = document.getElementById("content");
  hideSearchUI();

  showLoading(content, currentLocale);

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tab?.url ?? "";

  const { wtToken, wtUsername: storedUsername, nodeUrl: storedNodeUrl } =
    await new Promise((resolve) =>
      chrome.storage.sync.get(
        { wtToken: null, wtUsername: "", nodeUrl: "http://localhost:3000" },
        resolve
      )
    );

  const nodeHealth = await updateNodeStatusBar(storedNodeUrl, currentLocale);

  const userLine = document.getElementById("user-line");
  const signOutBtn = document.getElementById("wt-signout");

  if (storedUsername) {
    try {
      const host = new URL(storedNodeUrl).hostname;
      if (userLine) userLine.textContent = `${storedUsername}@${host}`;
    } catch { /* invalid URL */ }
  } else if (userLine) {
    userLine.textContent = "";
  }

  if (wtToken && signOutBtn) {
    signOutBtn.style.display = "block";
    signOutBtn.onclick = async () => {
      await new Promise((resolve) =>
        chrome.storage.sync.remove(["wtToken", "wtUsername"], resolve)
      );
      signOutBtn.style.display = "none";
      if (userLine) userLine.textContent = "";
      showLoginForm(content, currentLocale, storedNodeUrl, nodeHealth);
    };
  } else if (signOutBtn) {
    signOutBtn.style.display = "none";
    signOutBtn.onclick = null;
  }

  if (!wtToken) {
    showLoginForm(content, currentLocale, storedNodeUrl, nodeHealth);
    return;
  }

  let coords = null;
  try {
    const coordRes = await chrome.tabs.sendMessage(tab.id, { type: "GET_COORDS" });
    if (coordRes?.lat != null && coordRes?.lon != null) coords = coordRes;
  } catch { /* content script not on this page */ }

  const { nodeUrl, regionMissing } = await new Promise((resolve) =>
    chrome.runtime.sendMessage(
      { type: "RESOLVE_NODE", lat: coords?.lat ?? null, lon: coords?.lon ?? null },
      (res) => resolve(res ?? { nodeUrl: storedNodeUrl, regionMissing: false })
    )
  );

  if (regionMissing && coords != null) {
    const banner = document.createElement("div");
    banner.className = "warning-banner";
    banner.innerHTML = `<span aria-hidden="true">⚠️</span><span>${wtT("ui.lensRegionalWarning", currentLocale)}</span>`;
    document.getElementById("node-status-bar").after(banner);
  }

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

  content.innerHTML = `<p style="color:#94a3b8;font-size:13px">${wtT("ui.lensFetchingFrom", currentLocale, { node: nodeUrl })}</p>`;

  const authHeaders = { Authorization: `Bearer ${wtToken}` };

  try {
    await fetchAndRender(propertyId, null, content, nodeUrl, authHeaders, currentLocale, tab);
  } catch {
    content.innerHTML = "";
    const empty = document.createElement("div");
    empty.className = "state-empty";
    empty.innerHTML = `<div class="state-icon">⚡</div><p>${wtT("ui.lensCouldNotReachNode", currentLocale)}<br><a href="#" id="wt-settings-link2">${wtT("ui.lensCheckSettings", currentLocale)}</a></p>`;
    content.appendChild(empty);
    document.getElementById("wt-settings-link2")?.addEventListener("click", (e) => {
      e.preventDefault();
      chrome.runtime.openOptionsPage();
    });
    initSearchSection(nodeUrl, authHeaders, currentLocale, (id, name) => {
      showLoading(content, currentLocale);
      fetchAndRender(id, name, content, nodeUrl, authHeaders, currentLocale, null);
    });
  }
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && changes[WtI18n.LOCALE_STORAGE_KEY]) {
    init();
  }
});

init();
