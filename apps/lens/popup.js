// popup.js

import {
  ACCESS_HUB_URL,
  DEFAULT_NODE_URL,
  ONBOARDING_KEY,
  FEATURE_HIGHLIGHTS,
  truthyFactValue,
  computeCategoryBars,
  overallAccessibilityScore,
  propertyViewUrl,
  extractHotelNameFromTitle,
  buildHotelSearchQueries,
  pickBestPropertyMatch,
  propertyReportUrl,
} from "./lensLogic.js";

const TIER_CLASSES = {
  CONFIRMED: "tier--confirmed",
  VERIFIED: "tier--verified",
  AI_GUESS: "tier--ai-guess",
  OFFICIAL: "tier--official",
};

const CONFIDENCE_ONLY = new Set(["high", "medium", "low"]);

let currentLocale = "en";
let menuContext = { nodeUrl: DEFAULT_NODE_URL, hasToken: false };

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
  const menuBtn = document.getElementById("wt-menu-btn");
  if (menuBtn) {
    menuBtn.title = wtT("ui.lensMenu", locale);
    menuBtn.setAttribute("aria-label", wtT("ui.lensMenu", locale));
  }
  const menuTitle = document.getElementById("menu-title");
  if (menuTitle) menuTitle.textContent = wtT("ui.lensMenu", locale);
  const searchLabel = document.querySelector(".search-label");
  if (searchLabel) searchLabel.textContent = wtT("ui.searchProperties", locale);
  const searchInput = document.getElementById("search-input");
  if (searchInput) searchInput.placeholder = wtT("ui.searchPlaceholder", locale);
}

async function searchForProperty(name, nodeUrl, coords, headers = {}) {
  const queries = buildHotelSearchQueries(name);
  let bestCandidates = null;

  for (const q of queries) {
    try {
      const res = await nodeFetch(`${nodeUrl}/api/properties?q=${encodeURIComponent(q)}`, {
        headers,
        timeoutMs: 6000,
      });
      if (!res.ok) continue;
      const data = await res.json();
      const results = data.properties ?? [];
      if (results.length === 0) continue;

      const picked = pickBestPropertyMatch(name, results);
      if (picked) return picked;

      if (!bestCandidates) bestCandidates = results;
      // Keep scanning shorter/normalized queries — a later query may uniquely match.
    } catch {
      // network error — try next query
    }
  }

  if (!bestCandidates) return null;

  const pickedFromBest = pickBestPropertyMatch(name, bestCandidates);
  if (pickedFromBest) return pickedFromBest;

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
  return extractHotelNameFromTitle(tab?.title);
}

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
    const useStackedLayout = f.fieldName === "notes" || displayValue.length > 48;

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

function createScoreBlock(facts, locale) {
  const bars = computeCategoryBars(facts);
  const score = overallAccessibilityScore(bars);
  if (score == null) return null;

  const wrap = document.createElement("div");
  wrap.className = "score-row";

  const donut = document.createElement("div");
  donut.className = "score-donut";
  donut.style.setProperty("--pct", String(score));
  donut.setAttribute("aria-label", `${score}%`);
  const pctEl = document.createElement("span");
  pctEl.textContent = `${score}%`;
  donut.appendChild(pctEl);
  wrap.appendChild(donut);

  const barsEl = document.createElement("div");
  barsEl.className = "score-bars";
  bars.forEach((bar) => {
    const row = document.createElement("div");
    row.className = "score-bar-row";
    const label = document.createElement("span");
    label.className = "score-bar-label";
    label.textContent = wtT(bar.labelKey, locale);
    const pct = document.createElement("span");
    pct.className = "score-bar-pct";
    pct.textContent = `${bar.pct}%`;
    const track = document.createElement("div");
    track.className = "score-bar-track";
    const fill = document.createElement("div");
    fill.className = "score-bar-fill";
    fill.style.width = `${bar.pct}%`;
    track.appendChild(fill);
    row.appendChild(label);
    row.appendChild(pct);
    row.appendChild(track);
    barsEl.appendChild(row);
  });
  wrap.appendChild(barsEl);
  return wrap;
}

function createFeatureGrid(facts, locale) {
  const byName = new Map((facts ?? []).map((f) => [f.fieldName, f]));
  const grid = document.createElement("div");
  grid.className = "feature-grid";

  FEATURE_HIGHLIGHTS.forEach((fieldName) => {
    const fact = byName.get(fieldName);
    const present = fact && truthyFactValue(fact.value);
    const tile = document.createElement("div");
    tile.className = `feature-tile${present ? "" : " is-missing"}`;
    tile.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M8 12l2.5 2.5L16 9" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    const label = document.createElement("span");
    label.textContent = wtFieldLabel(fieldName, locale);
    tile.appendChild(label);
    grid.appendChild(tile);
  });

  return grid;
}

function initSearchSection(nodeUrl, authHeaders, locale, onSelect) {
  const section = document.getElementById("search-section");
  const input = document.getElementById("search-input");
  const results = document.getElementById("search-results");

  section.style.display = "block";

  const freshInput = input.cloneNode(true);
  freshInput.placeholder = wtT("ui.searchPlaceholder", locale);
  freshInput.classList.remove("is-searching");
  freshInput.removeAttribute("aria-busy");
  input.parentNode.replaceChild(freshInput, input);

  let searchTimer;
  let searchSeq = 0;

  function setSearching(active) {
    freshInput.classList.toggle("is-searching", active);
    freshInput.setAttribute("aria-busy", active ? "true" : "false");
    if (active) {
      results.innerHTML = "";
      const loading = document.createElement("div");
      loading.className = "search-loading";
      loading.setAttribute("role", "status");
      loading.innerHTML = `<span class="spinner" aria-hidden="true"></span>`;
      loading.appendChild(document.createTextNode(wtT("ui.searching", locale)));
      results.appendChild(loading);
    }
  }

  freshInput.addEventListener("input", () => {
    clearTimeout(searchTimer);
    const q = freshInput.value.trim();
    results.innerHTML = "";
    freshInput.classList.remove("is-searching");
    freshInput.setAttribute("aria-busy", "false");

    if (q.length < 2) return;

    setSearching(true);
    const seq = ++searchSeq;

    searchTimer = setTimeout(async () => {
      try {
        const res = await nodeFetch(`${nodeUrl}/api/properties?q=${encodeURIComponent(q)}`, {
          headers: authHeaders,
          timeoutMs: 6000,
        });
        if (seq !== searchSeq) return;
        if (!res.ok) {
          setSearching(false);
          results.innerHTML = "";
          const err = document.createElement("p");
          err.className = "search-empty";
          err.textContent = wtT("ui.searchNoResults", locale);
          results.appendChild(err);
          return;
        }
        const data = await res.json();
        if (seq !== searchSeq) return;
        const properties = data.properties ?? [];

        setSearching(false);
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
        if (seq !== searchSeq) return;
        setSearching(false);
        results.innerHTML = "";
        const err = document.createElement("p");
        err.className = "search-empty";
        err.textContent = wtT("ui.searchNoResults", locale);
        results.appendChild(err);
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

async function fetchOpenRegistration(nodeUrl) {
  try {
    const res = await nodeFetch(`${nodeUrl}/api/auth/register`, { timeoutMs: 4000 });
    if (!res.ok) return true;
    const data = await res.json();
    return data.openRegistration !== false;
  } catch {
    return true;
  }
}

function showLoginForm(content, locale, nodeUrl = DEFAULT_NODE_URL, nodeHealth = null) {
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
      <p id="wt-register-note" class="login-note" style="display:none"></p>
    </div>
  `;

  document.getElementById("wt-settings-link")?.addEventListener("click", (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });

  chrome.storage.sync.get({ nodeUrl }, (items) => {
    const registerLink = document.getElementById("wt-register-link");
    const registerNote = document.getElementById("wt-register-note");

    fetchOpenRegistration(items.nodeUrl).then((open) => {
      if (!open && registerLink && registerNote) {
        registerLink.textContent = wtT("ui.lensRegisterClosedLink", locale);
        registerNote.textContent = wtT("ui.lensRegisterClosedNote", locale);
        registerNote.style.display = "block";
      }
    });

    registerLink?.addEventListener("click", (e) => {
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
        const res = await nodeFetch(`${items.nodeUrl}/api/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password }),
          timeoutMs: 8000,
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
  content.innerHTML = `
    <div class="loading-wrap">
      <div class="spinner" aria-hidden="true"></div>
      <p style="color:var(--wt-muted);font-size:13px;font-weight:600" data-wt-loading="1">${message ?? wtT("ui.lensCheckingPage", locale)}</p>
      <div class="skeleton skel-block"></div>
      <div class="skeleton skel-row"></div>
      <div class="skeleton skel-row" style="width:70%"></div>
    </div>
  `;
}

async function fetchAndRender(resolvedId, displayName, content, nodeUrl, authHeaders, locale, tab) {
  const res = await nodeFetch(
    `${nodeUrl}/api/properties/${encodeURIComponent(resolvedId)}/accessibility`,
    { headers: authHeaders, timeoutMs: 6000 }
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
    renderNotFound(content, nodeUrl, authHeaders, locale, displayName, resolvedId);
    return;
  }

  if (!res.ok) {
    renderNotFound(content, nodeUrl, authHeaders, locale, displayName, resolvedId);
    return;
  }

  const data = await res.json();
  const facts = data.facts ?? [];
  const prop = data.property;
  const propertyId = prop?.id ?? resolvedId;

  content.innerHTML = "";

  const hasFacts = facts.length > 0;
  const pill = document.createElement("div");
  if (hasFacts) {
    pill.className = "status-pill";
    pill.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M5 13l4 4L19 7" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    pill.appendChild(document.createTextNode(wtT("ui.lensInfoFound", locale)));
  } else {
    pill.className = "status-pill status-pill--matched";
    pill.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M8 12l2.5 2.5L16 9" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    pill.appendChild(document.createTextNode(wtT("ui.lensPropertyMatched", locale)));
  }
  content.appendChild(pill);

  const card = document.createElement("div");
  card.className = "property-card";
  const cardBody = document.createElement("div");
  cardBody.className = "property-card-body";
  const nameEl = document.createElement("p");
  nameEl.className = "property-name";
  nameEl.textContent = prop?.name ?? displayName ?? propertyId;
  cardBody.appendChild(nameEl);
  if (prop?.location) {
    const loc = document.createElement("p");
    loc.className = "property-location";
    loc.textContent = prop.location;
    cardBody.appendChild(loc);
  }
  card.appendChild(cardBody);
  content.appendChild(card);

  const scoreBlock = createScoreBlock(facts, locale);
  if (scoreBlock) content.appendChild(scoreBlock);

  if (hasFacts) {
    content.appendChild(createFeatureGrid(facts, locale));
  }

  const photosSection = createAuditPhotosSection(data.auditPhotos, data.hasAiGuess, locale);
  if (photosSection) content.appendChild(photosSection);

  if (!hasFacts) {
    const empty = document.createElement("div");
    empty.className = "state-empty";
    empty.style.paddingTop = "8px";
    const title = document.createElement("h2");
    title.textContent = wtT("ui.lensNoInfoYet", locale);
    empty.appendChild(title);
    const p = document.createElement("p");
    p.textContent = wtT("ui.lensNoFactsHint", locale);
    empty.appendChild(p);
    content.appendChild(empty);
  } else {
    content.appendChild(createFactsTable(facts, locale));
  }

  const detailsBtn = document.createElement("button");
  detailsBtn.type = "button";
  detailsBtn.className = "btn-primary";
  detailsBtn.textContent = wtT("ui.lensViewDetails", locale);
  detailsBtn.addEventListener("click", () => {
    chrome.tabs.create({ url: propertyViewUrl(nodeUrl, propertyId) });
  });
  content.appendChild(detailsBtn);

  const reportBtn = document.createElement("button");
  reportBtn.type = "button";
  reportBtn.className = "btn-secondary";
  reportBtn.textContent = wtT("ui.lensReportIssue", locale);
  reportBtn.addEventListener("click", () => {
    chrome.tabs.create({ url: propertyReportUrl(nodeUrl, propertyId) });
  });
  content.appendChild(reportBtn);

  const hint = document.createElement("p");
  hint.className = "access-hint";
  hint.textContent = wtT("ui.lensAccessAppHint", locale);
  content.appendChild(hint);

  showSearchToggle(nodeUrl, authHeaders, locale, (id, name) => {
    showLoading(content, locale);
    fetchAndRender(id, name, content, nodeUrl, authHeaders, locale, null);
  });
}

function renderNotFound(content, nodeUrl, authHeaders, locale, displayName, propertyId) {
  content.innerHTML = "";

  const empty = document.createElement("div");
  empty.className = "state-empty";

  const icon = document.createElement("div");
  icon.className = "state-icon";
  icon.innerHTML = `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M2 12h20M12 2a15 15 0 010 20M12 2a15 15 0 000 20" stroke-linecap="round"/></svg>`;
  empty.appendChild(icon);

  const title = document.createElement("h2");
  title.textContent = wtT("ui.lensNoInfoYet", locale);
  empty.appendChild(title);

  const msg = document.createElement("p");
  msg.textContent = displayName
    ? wtT("ui.lensNoDataFor", locale, { name: displayName })
    : wtT("ui.lensNoDataProperty", locale);
  empty.appendChild(msg);

  const requestBtn = document.createElement("button");
  requestBtn.type = "button";
  requestBtn.className = "btn-primary";
  requestBtn.textContent = wtT("ui.lensRequestProperty", locale);
  requestBtn.addEventListener("click", () => {
    const target = propertyId && propertyId !== "unknown"
      ? `${ACCESS_HUB_URL}/properties/${encodeURIComponent(propertyId)}?node=${encodeURIComponent(nodeUrl)}`
      : `${ACCESS_HUB_URL}/?node=${encodeURIComponent(nodeUrl)}`;
    chrome.tabs.create({ url: target });
  });
  empty.appendChild(requestBtn);

  const learn = document.createElement("a");
  learn.href = "#";
  learn.style.cssText = "display:inline-block;margin-top:8px;font-size:12px;font-weight:600";
  learn.textContent = wtT("ui.lensLearnHowData", locale);
  learn.addEventListener("click", (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: `${ACCESS_HUB_URL}/` });
  });
  empty.appendChild(learn);

  content.appendChild(empty);

  initSearchSection(nodeUrl, authHeaders, locale, (id, name) => {
    showLoading(content, locale);
    fetchAndRender(id, name, content, nodeUrl, authHeaders, locale, null);
  });
}

function closeMenu() {
  document.getElementById("menu-overlay")?.classList.remove("is-open");
}

function openMenu() {
  const list = document.getElementById("menu-list");
  const locale = currentLocale;
  const { nodeUrl, hasToken } = menuContext;
  if (!list) return;

  const items = [
    { key: "lensMenuHome", url: `${ACCESS_HUB_URL}/` },
    { key: "lensMenuSearch", url: `${ACCESS_HUB_URL}/` },
    { key: "lensMenuFavorites", url: `${ACCESS_HUB_URL}/` },
    { key: "lensMenuRecent", url: `${ACCESS_HUB_URL}/` },
    { divider: true },
    { key: "lensMenuHowItWorks", url: `${ACCESS_HUB_URL}/` },
    { key: "lensMenuHelp", url: `${ACCESS_HUB_URL}/` },
    { key: "lensMenuReport", url: `${ACCESS_HUB_URL}/` },
    { key: "lensMenuSettings", action: "settings" },
    {
      key: hasToken ? "signOut" : "lensMenuSignIn",
      action: hasToken ? "signout" : "signin",
    },
  ];

  list.innerHTML = "";
  items.forEach((item) => {
    if (item.divider) {
      const d = document.createElement("li");
      d.className = "menu-divider";
      d.setAttribute("aria-hidden", "true");
      list.appendChild(d);
      return;
    }
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = wtT(`ui.${item.key}`, locale);
    btn.addEventListener("click", async () => {
      closeMenu();
      if (item.action === "settings") {
        chrome.runtime.openOptionsPage();
        return;
      }
      if (item.action === "signout") {
        await new Promise((resolve) =>
          chrome.storage.sync.remove(["wtToken", "wtUsername"], resolve)
        );
        init();
        return;
      }
      if (item.action === "signin") {
        const content = document.getElementById("content");
        showLoginForm(content, locale, nodeUrl);
        return;
      }
      if (item.url) chrome.tabs.create({ url: item.url });
    });
    li.appendChild(btn);
    list.appendChild(li);
  });

  document.getElementById("menu-overlay")?.classList.add("is-open");
}

function setNodeStatusBarVisible(visible) {
  const bar = document.getElementById("node-status-bar");
  if (bar) bar.style.display = visible ? "" : "none";
}

function showOnboarding(content, locale, onDone) {
  hideSearchUI();
  setNodeStatusBarVisible(false);
  let step = 0;
  const steps = [
    { title: "lensOnboardingWelcomeTitle", body: "lensOnboardingWelcomeBody" },
    { title: "lensOnboardingHowTitle", body: "lensOnboardingHowBody" },
    { title: "lensOnboardingDoTitle", body: "lensOnboardingDoBody" },
    { title: "lensOnboardingReadyTitle", body: "lensOnboardingReadyBody" },
  ];

  async function finish() {
    await new Promise((resolve) =>
      chrome.storage.local.set({ [ONBOARDING_KEY]: true }, resolve)
    );
    setNodeStatusBarVisible(true);
    onDone();
  }

  function render() {
    const s = steps[step];
    content.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "onboard";

    const art = document.createElement("div");
    art.className = "onboard-art";
    art.innerHTML = `<svg width="40" height="40" viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M16 2L28 9v14L16 30 4 23V9L16 2z" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round"/><path d="M16 9l4 6H12l4-6z" fill="currentColor"/><path d="M10 20h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
    wrap.appendChild(art);

    const h = document.createElement("h2");
    h.textContent = wtT(`ui.${s.title}`, locale);
    wrap.appendChild(h);

    const p = document.createElement("p");
    p.textContent = wtT(`ui.${s.body}`, locale);
    wrap.appendChild(p);

    const dots = document.createElement("div");
    dots.className = "onboard-dots";
    steps.forEach((_, i) => {
      const d = document.createElement("span");
      if (i === step) d.className = "is-active";
      dots.appendChild(d);
    });
    wrap.appendChild(dots);

    const actions = document.createElement("div");
    actions.className = "onboard-actions";

    if (step > 0) {
      const back = document.createElement("button");
      back.type = "button";
      back.className = "btn-secondary";
      back.textContent = wtT("ui.lensOnboardingBack", locale);
      back.addEventListener("click", () => {
        step -= 1;
        render();
      });
      actions.appendChild(back);
    }

    const next = document.createElement("button");
    next.type = "button";
    next.className = "btn-primary";
    next.textContent =
      step === steps.length - 1
        ? wtT("ui.lensOnboardingGotIt", locale)
        : wtT("ui.lensOnboardingNext", locale);
    next.addEventListener("click", () => {
      if (step >= steps.length - 1) finish();
      else {
        step += 1;
        render();
      }
    });
    actions.appendChild(next);
    wrap.appendChild(actions);

    const skip = document.createElement("button");
    skip.type = "button";
    skip.className = "onboard-skip";
    skip.textContent = wtT("ui.lensOnboardingSkip", locale);
    skip.addEventListener("click", finish);
    wrap.appendChild(skip);

    content.appendChild(wrap);
  }

  render();
}

async function init() {
  currentLocale = await wtGetLocale();
  applyPopupStaticLabels(currentLocale);

  const content = document.getElementById("content");
  hideSearchUI();
  closeMenu();

  const onboarded = await new Promise((resolve) =>
    chrome.storage.local.get({ [ONBOARDING_KEY]: false }, (items) =>
      resolve(Boolean(items[ONBOARDING_KEY]))
    )
  );

  if (!onboarded) {
    showOnboarding(content, currentLocale, () => init());
    return;
  }

  setNodeStatusBarVisible(true);
  showLoading(content, currentLocale);

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tab?.url ?? "";

  const { wtToken, wtUsername: storedUsername, nodeUrl: storedNodeUrl } =
    await new Promise((resolve) =>
      chrome.storage.sync.get(
        { wtToken: null, wtUsername: "", nodeUrl: DEFAULT_NODE_URL },
        resolve
      )
    );

  menuContext = { nodeUrl: storedNodeUrl, hasToken: Boolean(wtToken) };

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

  document.querySelectorAll(".warning-banner").forEach((el) => el.remove());
  if (regionMissing && coords != null) {
    const banner = document.createElement("div");
    banner.className = "warning-banner";
    banner.innerHTML = `<span aria-hidden="true">!</span><span>${wtT("ui.lensRegionalWarning", currentLocale)}</span>`;
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

  showLoading(content, currentLocale, wtT("ui.lensFetchingFrom", currentLocale, { node: nodeUrl }));

  const authHeaders = { Authorization: `Bearer ${wtToken}` };

  try {
    await fetchAndRender(propertyId, null, content, nodeUrl, authHeaders, currentLocale, tab);
  } catch {
    content.innerHTML = "";
    const empty = document.createElement("div");
    empty.className = "state-empty";
    empty.innerHTML = `<div class="state-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M13 2L3 14h8l-1 8 10-12h-8l1-8z" stroke-linejoin="round"/></svg></div><p>${wtT("ui.lensCouldNotReachNode", currentLocale)}<br><a href="#" id="wt-settings-link2">${wtT("ui.lensCheckSettings", currentLocale)}</a></p>`;
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

document.getElementById("wt-menu-btn")?.addEventListener("click", openMenu);
document.getElementById("wt-menu-close")?.addEventListener("click", closeMenu);

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && changes[WtI18n.LOCALE_STORAGE_KEY]) {
    init();
  }
});

init();
