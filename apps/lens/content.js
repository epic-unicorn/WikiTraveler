// content.js — injected into booking pages

// ---------------------------------------------------------------------------
// Node URL — resolved once per page via registry (if configured) or storage
// ---------------------------------------------------------------------------

let _nodeUrl = null;
let _regionMissing = false;
let _locale = "en";

wtGetLocale().then((loc) => {
  _locale = loc;
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && changes[WtI18n.LOCALE_STORAGE_KEY]) {
    _locale = changes[WtI18n.LOCALE_STORAGE_KEY].newValue ?? WtI18n.DEFAULT_LOCALE;
  }
});

/**
 * Extract lat/lon from the current page.
 * Booking.com and others embed coordinates in og:image or JSON-LD.
 */
function extractCoordinates() {
  // 1. JSON-LD (most reliable — present on Booking.com hotel detail pages)
  for (const el of document.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const data = JSON.parse(el.textContent);
      const items = Array.isArray(data) ? data : [data];
      for (const item of items) {
        const geo = item.geo ?? item["@graph"]?.find?.((n) => n.geo)?.geo;
        if (geo?.latitude != null && geo?.longitude != null) {
          return { lat: parseFloat(geo.latitude), lon: parseFloat(geo.longitude) };
        }
      }
    } catch { /* malformed JSON-LD */ }
  }

  // 2. Microdata latitude/longitude meta tags
  const latMeta = document.querySelector('meta[itemprop="latitude"]')?.getAttribute("content");
  const lonMeta = document.querySelector('meta[itemprop="longitude"]')?.getAttribute("content");
  if (latMeta && lonMeta) {
    const lat = parseFloat(latMeta), lon = parseFloat(lonMeta);
    if (!isNaN(lat) && !isNaN(lon)) return { lat, lon };
  }

  // 4. Booking.com data attributes on map/property elements
  const dataEl = document.querySelector("[data-lat][data-lng], [data-latitude][data-longitude], [data-map-lat][data-map-lng]");
  if (dataEl) {
    const lat = parseFloat(dataEl.getAttribute("data-lat") ?? dataEl.getAttribute("data-latitude") ?? dataEl.getAttribute("data-map-lat") ?? "");
    const lon = parseFloat(dataEl.getAttribute("data-lng") ?? dataEl.getAttribute("data-longitude") ?? dataEl.getAttribute("data-map-lng") ?? "");
    if (!isNaN(lat) && !isNaN(lon)) return { lat, lon };
  }

  // 5. Scan inline scripts for coordinate assignments (e.g. window.b_lat or similar)
  const coordPattern = /(?:latitude|b_lat|hotel_lat)['":\s]+(-?\d{1,3}\.\d+).*?(?:longitude|b_lng|hotel_lng)['":\s]+(-?\d{1,3}\.\d+)/s;
  for (const el of document.querySelectorAll("script:not([src])")) {
    const m = coordPattern.exec(el.textContent ?? "");
    if (m) {
      const lat = parseFloat(m[1]), lon = parseFloat(m[2]);
      if (!isNaN(lat) && !isNaN(lon)) return { lat, lon };
    }
  }

  // 6. Booking.com og:image URL params (?dest_lat=&dest_lon=) — search pages
  const ogImage = document.querySelector('meta[property="og:image"]')?.getAttribute("content") ?? "";
  try {
    const u = new URL(ogImage);
    const lat = parseFloat(u.searchParams.get("dest_lat") ?? "");
    const lon = parseFloat(u.searchParams.get("dest_lon") ?? "");
    if (!isNaN(lat) && !isNaN(lon)) return { lat, lon };
  } catch { /* not a valid URL */ }

  return null;
}

async function getNodeUrl() {
  if (_nodeUrl) return _nodeUrl;
  const coords = extractCoordinates();
  const result = await new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { type: "RESOLVE_NODE", lat: coords?.lat ?? null, lon: coords?.lon ?? null },
      (res) => resolve(res ?? { nodeUrl: "http://localhost:3000", regionMissing: false })
    );
  });
  _nodeUrl = result.nodeUrl ?? "http://localhost:3000";
  _regionMissing = result.regionMissing === true && coords != null;
  return _nodeUrl;
}

// ---------------------------------------------------------------------------
// Auth headers — loaded once, invalidated on token change
// ---------------------------------------------------------------------------

let _authHeadersPromise = null;

function getAuthHeaders() {
  if (_authHeadersPromise) return _authHeadersPromise;
  _authHeadersPromise = new Promise((resolve) =>
    chrome.storage.sync.get({ wtToken: null }, (items) =>
      resolve(items.wtToken ? { Authorization: `Bearer ${items.wtToken}` } : {})
    )
  );
  return _authHeadersPromise;
}

// Invalidate cache when the user changes settings
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "sync") return;
  if ("wtToken" in changes) _authHeadersPromise = null;
  if ("nodeUrl" in changes) {
    _nodeUrl = null;
    _regionMissing = false;
    _cardCache.clear();
  }
});

// ---------------------------------------------------------------------------
// Page type detection
// ---------------------------------------------------------------------------

function isListingPage() {
  const url = window.location.href;
  return (
    /booking\.com\/searchresults/.test(url) ||
    /expedia\.com\/(Hotel-Search|flights-Hotel)/.test(url) ||
    /hotels\.com\/search/.test(url)
  );
}

// ---------------------------------------------------------------------------
// Search API
// ---------------------------------------------------------------------------

async function searchForProperty(name, nodeUrl, coords, headers = {}) {
  const words = name.split(/\s+/);
  let bestCandidates = null; // { results, q } from the most specific query that returned anything

  for (let len = words.length; len >= 2; len--) {
    const q = words.slice(0, len).join(" ");
    try {
      const res = await nodeFetch(`${nodeUrl}/api/properties?q=${encodeURIComponent(q)}`, {
        headers,
        timeoutMs: 6000,
      });
      if (!res.ok) continue;
      const data = await res.json();
      const results = data.properties ?? [];
      if (results.length === 0) continue;

      const lower = name.toLowerCase();
      // 1. Exact name match — always wins immediately
      const exact = results.find((p) => p.name.toLowerCase() === lower);
      if (exact) return { match: exact, candidates: null };

      // 2. Stored name is a meaningful prefix of the extracted name
      //    (only when there is exactly ONE such candidate — generic chain names
      //     like "Holiday Inn" match too many hotels, so we fall through to
      //     coordinate scoring instead)
      const prefixMatches = results.filter((p) => lower.startsWith(p.name.toLowerCase()));
      if (prefixMatches.length === 1) return { match: prefixMatches[0], candidates: null };

      // Keep the most specific (longest query) set of candidates and stop —
      // shorter queries would only produce noisier results.
      if (!bestCandidates) bestCandidates = { results, q };
      break;
    } catch {
      // network error — try shorter query
    }
  }

  if (!bestCandidates) return { match: null, candidates: null };

  const { results } = bestCandidates;

  // 3. Use coordinates to pick the closest candidate
  if (coords?.lat != null && coords?.lon != null) {
    const scored = results
      .filter((p) => p.lat != null && p.lon != null)
      .map((p) => ({
        p,
        dist: Math.hypot(p.lat - coords.lat, p.lon - coords.lon),
      }))
      .sort((a, b) => a.dist - b.dist);

    if (scored.length > 0 && scored[0].dist < 0.005) {
      // Within ~500m — confident match
      return { match: scored[0].p, candidates: null };
    }
    // Closest candidate is too far away — this is not the right property
    return { match: null, candidates: null };
  }

  // 4. Single result but we reached here via a short/generic query — treat
  //    as ambiguous unless it's a very close coordinate match (already handled).
  if (results.length === 1) {
    return { match: null, candidates: results };
  }

  // Multiple candidates, no way to pick — surface them all
  return { match: null, candidates: results };
}

// ---------------------------------------------------------------------------
// Tooltip — small hover panel for listing pages
// ---------------------------------------------------------------------------

let _tooltip = null;
let _tooltipHideTimer = null;
let _keyboardTooltip = false;

function injectLensA11yStyles() {
  if (document.getElementById("wt-lens-a11y-styles")) return;
  const style = document.createElement("style");
  style.id = "wt-lens-a11y-styles";
  style.textContent = `
    .wt-lens-card-trigger {
      position: absolute;
      top: 8px;
      right: 8px;
      z-index: 9999;
      width: 44px;
      height: 44px;
      border: 2px solid #1e3a8a;
      border-radius: 999px;
      background: #fff;
      color: #1e3a8a;
      font-size: 18px;
      font-weight: 700;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0;
    }
    .wt-lens-card-trigger:focus-visible {
      outline: 2px solid #1d4ed8;
      outline-offset: 2px;
    }
  `;
  document.head.appendChild(style);
}

function ensureCardTrigger(card) {
  if (card.__wtTrigger) return card.__wtTrigger;
  injectLensA11yStyles();
  const computed = getComputedStyle(card);
  if (computed.position === "static") card.style.position = "relative";

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "wt-lens-card-trigger";
  btn.setAttribute("aria-label", wtT("ui.lensShowA11yInfo", _locale));
  btn.textContent = wtT("ui.lensA11yShort", _locale);

  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    _keyboardTooltip = true;
    handleCardEnter(card, true);
  });

  btn.addEventListener("focus", () => {
    _keyboardTooltip = true;
    handleCardEnter(card, true);
  });

  btn.addEventListener("blur", () => {
    _tooltipHideTimer = setTimeout(() => {
      if (!_keyboardTooltip) return;
      removeTooltip();
      _keyboardTooltip = false;
    }, 200);
  });

  card.appendChild(btn);
  card.__wtTrigger = btn;
  return btn;
}

function removeTooltip() {
  if (_tooltip) {
    _tooltip.remove();
    _tooltip = null;
  }
}

function showTooltip(anchorEl, facts, propertyName, interactive = false) {
  clearTimeout(_tooltipHideTimer);
  removeTooltip();

  _tooltip = document.createElement("div");
  _tooltip.id = "wt-lens-tooltip";
  _tooltip.setAttribute("role", interactive ? "dialog" : "tooltip");
  if (interactive) {
    _tooltip.setAttribute(
      "aria-label",
      wtT("ui.lensTooltipFor", _locale, { name: propertyName ?? "property" })
    );
  }
  _tooltip.style.cssText = `
    position: fixed;
    z-index: 2147483647;
    width: 280px;
    background: #fff;
    border: 2px solid #1e3a8a;
    border-radius: 12px;
    box-shadow: 0 8px 28px rgba(0,0,0,0.18);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 12px;
    color: #0f172a;
    overflow: hidden;
    pointer-events: ${interactive ? "auto" : "none"};
  `;

  const hdr = document.createElement("div");
  hdr.style.cssText =
    "background:#1e3a8a;color:#fff;padding:8px 12px;font-weight:700;font-size:12px;" +
    "white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:flex;align-items:center;gap:6px";

  const logoSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  logoSvg.setAttribute("width", "14");
  logoSvg.setAttribute("height", "14");
  logoSvg.setAttribute("viewBox", "0 0 32 32");
  logoSvg.setAttribute("fill", "none");
  logoSvg.setAttribute("aria-hidden", "true");
  logoSvg.style.flexShrink = "0";
  const hexPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
  hexPath.setAttribute("d", "M16 2L28 9v14L16 30 4 23V9L16 2z");
  hexPath.setAttribute("stroke", "currentColor");
  hexPath.setAttribute("stroke-width", "2");
  hexPath.setAttribute("stroke-linejoin", "round");
  logoSvg.appendChild(hexPath);
  hdr.appendChild(logoSvg);

  const hdrText = document.createElement("span");
  hdrText.style.overflow = "hidden";
  hdrText.style.textOverflow = "ellipsis";
  hdrText.textContent = propertyName ?? "WikiTraveler";
  hdr.appendChild(hdrText);
  _tooltip.appendChild(hdr);

  if (_regionMissing) {
    const warn = document.createElement("div");
    warn.style.cssText =
      "padding:6px 12px;background:#fffbeb;color:#92400e;font-size:11px;border-bottom:1px solid #fde68a";
    warn.textContent = wtT("ui.lensRegionalWarning", _locale);
    _tooltip.appendChild(warn);
  }

  const bodyEl = document.createElement("div");
  bodyEl.style.cssText = "padding:8px 12px;max-height:200px;overflow-y:auto";

  if (!facts || facts.length === 0) {
    bodyEl.style.color = "#94a3b8";
    bodyEl.textContent = wtT("ui.noAccessibilityData", _locale);
  } else {
    const table = document.createElement("table");
    table.style.cssText = "width:100%;border-collapse:collapse";
    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");
    [wtT("ui.lensFactFeature", _locale), wtT("ui.lensFactValue", _locale)].forEach((label) => {
      const th = document.createElement("th");
      th.scope = "col";
      th.style.cssText = "padding:5px 6px 5px 0;color:#64748b;font-size:10px;text-align:left;font-weight:700";
      th.textContent = label;
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    table.appendChild(thead);
    const tbody = document.createElement("tbody");
    facts.slice(0, 8).forEach((f) => {
      const row = document.createElement("tr");
      row.style.borderBottom = "1px solid #e2e8f0";

      const labelCell = document.createElement("td");
      labelCell.style.cssText = "padding:5px 6px 5px 0;color:#0f172a;font-weight:500;vertical-align:middle";
      labelCell.textContent = wtFieldLabel(f.fieldName, _locale);

      const valueCell = document.createElement("td");
      valueCell.style.cssText = "padding:5px 0;color:#334155;text-align:right;vertical-align:middle";
      valueCell.textContent = f.value;

      row.appendChild(labelCell);
      row.appendChild(valueCell);
      tbody.appendChild(row);
    });
    table.appendChild(tbody);
    bodyEl.appendChild(table);
  }
  _tooltip.appendChild(bodyEl);
  document.body.appendChild(_tooltip);

  // Position beside the card
  const rect = anchorEl.getBoundingClientRect();
  const ttW = 280;
  const ttH = _tooltip.offsetHeight || 160;
  let left = rect.right + 10;
  if (left + ttW > window.innerWidth - 8) left = rect.left - ttW - 10;
  if (left < 8) left = 8;
  let top = rect.top;
  if (top + ttH > window.innerHeight - 8) top = window.innerHeight - ttH - 8;
  if (top < 8) top = 8;
  _tooltip.style.left = `${left}px`;
  _tooltip.style.top = `${top}px`;
}

// ---------------------------------------------------------------------------
// Listing page — hotel card key extraction
// ---------------------------------------------------------------------------

function extractKeyFromCard(card) {
  // Booking.com: data-hotelid on the card or a child element
  const hotelId =
    card.getAttribute("data-hotelid") ??
    card.querySelector("[data-hotelid]")?.getAttribute("data-hotelid");
  if (hotelId) return `booking-${hotelId}`;

  // Booking.com: anchor link with /hotel/country/slug
  const link = card.querySelector('a[href*="/hotel/"]');
  if (link) {
    try {
      const u = new URL(link.href, location.origin);
      const hid = u.searchParams.get("hotelid");
      if (hid) return `booking-${hid}`;
      const m = u.pathname.match(/\/hotel\/[^/]+\/([^./?#]+)/);
      if (m) return `booking-${m[1]}`;
    } catch {
      // ignore malformed URLs
    }
  }

  // Expedia: anchor link with /h{ID}.Hotel
  const expediaLink = card.querySelector('a[href*=".Hotel"]');
  if (expediaLink) {
    const m = expediaLink.href.match(/\/h(\d+)\.Hotel/i);
    if (m) return `expedia-${m[1]}`;
  }

  // Fallback: use heading text for a name-search
  const heading = card.querySelector('[data-testid="title"], h3, h2, .sr_item_content h3');
  const name = heading?.textContent?.trim();
  if (name) return `name:${name}`;

  return null;
}

// ---------------------------------------------------------------------------
// Listing page — hover handlers
// ---------------------------------------------------------------------------

let _hoverTimer = null;
const _cardCache = new Map(); // key -> { facts, name } | null

async function handleCardEnter(card, fromKeyboard = false) {
  const nodeUrl = await getNodeUrl();
  const key = extractKeyFromCard(card);
  if (!key) return;

  clearTimeout(_hoverTimer);
  clearTimeout(_tooltipHideTimer);

  _hoverTimer = setTimeout(async () => {
    if (_cardCache.has(key)) {
      const cached = _cardCache.get(key);
      if (cached) showTooltip(card, cached.facts, cached.name, fromKeyboard);
      return;
    }

    let propertyId = key;
    let propertyName = null;

    const headers = await getAuthHeaders();

    if (key.startsWith("name:")) {
      const name = key.slice(5);
      const { match } = await searchForProperty(name, nodeUrl, null, headers);
      if (!match) {
        _cardCache.set(key, null);
        return;
      }
      propertyId = match.id;
      propertyName = match.name;
    }

    try {
      const res = await nodeFetch(
        `${nodeUrl}/api/properties/${encodeURIComponent(propertyId)}/accessibility`,
        { headers, timeoutMs: 6000 }
      );

      if (res.status === 401 || res.status === 403) {
        _authHeadersPromise = null; // force re-read on next attempt
        return; // silently skip — tooltip not shown
      }

      if (res.status === 404 && !key.startsWith("name:")) {
        // Not in node by booking ID — retry by hotel name from the card heading
        const heading = card.querySelector('[data-testid="title"], h3, h2, .sr_item_content h3');
        const headingName = heading?.textContent?.trim();
        if (headingName) {
          const { match } = await searchForProperty(headingName, nodeUrl, null, headers);
          if (match) {
            const res2 = await nodeFetch(
              `${nodeUrl}/api/properties/${encodeURIComponent(match.id)}/accessibility`,
              { headers, timeoutMs: 6000 }
            );
            if (res2.ok) {
              const data2 = await res2.json();
              const entry2 = { facts: data2.facts ?? [], name: match.name };
              _cardCache.set(key, entry2);
              if (card.matches(":hover")) showTooltip(card, entry2.facts, entry2.name);
              return;
            }
          }
        }
        _cardCache.set(key, null);
        return;
      }

      if (!res.ok) {
        _cardCache.set(key, null);
        return;
      }
      const data = await res.json();
      const entry = { facts: data.facts ?? [], name: propertyName };
      _cardCache.set(key, entry);
      if (card.matches(":hover") || fromKeyboard) showTooltip(card, entry.facts, entry.name, fromKeyboard);
    } catch {
      _cardCache.set(key, null);
    }
  }, 350);
}

function handleCardLeave() {
  clearTimeout(_hoverTimer);
  _tooltipHideTimer = setTimeout(removeTooltip, 150);
}

function attachCardListeners(card) {
  if (card.__wtAttached) return;
  card.__wtAttached = true;
  ensureCardTrigger(card);
  card.addEventListener("mouseenter", () => {
    _keyboardTooltip = false;
    handleCardEnter(card, false);
  });
  card.addEventListener("mouseleave", handleCardLeave);
}

const CARD_SELECTORS = [
  '[data-testid="property-card"]',
  '[data-hotelid]',
  ".sr_item",
].join(", ");

function attachListingHovers() {
  document.querySelectorAll(CARD_SELECTORS).forEach(attachCardListeners);
}

let _listingObserver = null;

function startListingMode() {
  attachListingHovers();
  if (_listingObserver) _listingObserver.disconnect();
  _listingObserver = new MutationObserver(attachListingHovers);
  _listingObserver.observe(document.body, { childList: true, subtree: true });
}

function stopListingMode() {
  if (_listingObserver) {
    _listingObserver.disconnect();
    _listingObserver = null;
  }
  removeTooltip();
}

// ---------------------------------------------------------------------------
// Property ID extraction — heuristics for supported sites
// ---------------------------------------------------------------------------

function extractPropertyId() {
  const url = window.location.href;
  const params = new URLSearchParams(window.location.search);

  // 1. Explicit meta tag — any site can add <meta name="wt-property-id" content="PROP123">
  //    This is the zero-effort integration path (no SDK needed).
  const metaTag = document.querySelector('meta[name="wt-property-id"]');
  const metaValue = metaTag?.getAttribute("content")?.trim();
  if (metaValue) return metaValue;

  // 2. ?hotel= param — used by agency sites with deep-linked hotel pages
  const hotelParam = params.get("hotel");
  if (hotelParam) return hotelParam;

  // 3. Booking.com: query param hotelid= or /hotel/country/property-name
  const bookingQuery = params.get("hotelid");
  if (bookingQuery) return `booking-${bookingQuery}`;

  const bookingPath = url.match(/booking\.com\/hotel\/[^/]+\/([^.?#]+)/);
  if (bookingPath) return `booking-${bookingPath[1]}`;

  // 4. Expedia / Hotels.com: /h{ID}.Hotel-Information
  const expediaMatch = url.match(/\/h(\d+)\.Hotel/i);
  if (expediaMatch) return `expedia-${expediaMatch[1]}`;

  // 5. Fallback: derive a slug from the document title
  const titleSlug = document.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 60);
  return `page-${titleSlug}`;
}

// ---------------------------------------------------------------------------
// Main — listing-page hover tooltips only; detail data is shown in the popup
// ---------------------------------------------------------------------------

async function run() {
  const thisRunId = ++_runId;
  await getNodeUrl();
  if (thisRunId !== _runId) return;

  if (isListingPage()) {
    startListingMode();
    return;
  }

  stopListingMode();
}

// Debounce to avoid firing on every navigation fragment change
let runTimer;
let _runId = 0;

function scheduleRun() {
  clearTimeout(runTimer);
  runTimer = setTimeout(run, 800);
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "GET_PROPERTY_ID") {
    sendResponse({ propertyId: extractPropertyId() });
  }
  if (msg.type === "GET_COORDS") {
    const coords = extractCoordinates();
    sendResponse(coords ?? { lat: null, lon: null });
  }
});

// Watch the meta tag for content changes (SPA navigation updates the meta tag directly)
function observeMetaTag() {
  const metaTag = document.querySelector('meta[name="wt-property-id"]');
  if (!metaTag) return false;
  new MutationObserver(() => scheduleRun())
    .observe(metaTag, { attributes: true, attributeFilter: ["content"] });
  return true;
}

if (!observeMetaTag()) {
  // Meta tag not yet in DOM — watch for its creation
  const domObserver = new MutationObserver(() => {
    if (observeMetaTag()) domObserver.disconnect();
  });
  domObserver.observe(document.documentElement, { childList: true, subtree: true });
}

// Handle browser back/forward navigation
window.addEventListener("popstate", scheduleRun);

// Initial run (handles direct URL loads like ?hotel=demo-grand-hotel-vienna)
scheduleRun();
