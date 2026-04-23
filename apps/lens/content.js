// content.js — injected into booking pages

// Quality tier ordering (higher = more reliable)
const TIER_ORDER = { OFFICIAL: 0, AI_GUESS: 1, VERIFIED: 2, CONFIRMED: 3 };

// Single quality dot color: green = user-verified, amber = AI/official
function qualityColor(facts) {
  const topTier = facts.reduce((best, f) => {
    return (TIER_ORDER[f.tier] ?? 0) > (TIER_ORDER[best.tier] ?? 0) ? f : best;
  }, facts[0]);
  return (topTier.tier === "CONFIRMED" || topTier.tier === "VERIFIED") ? "#34d399" : "#fbbf24";
}

// ---------------------------------------------------------------------------
// Node URL — resolved once per page via registry (if configured) or storage
// ---------------------------------------------------------------------------

let _nodeUrl = null;
let _regionMissing = false;

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
  console.log("[lens] coords", coords);
  const result = await new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { type: "RESOLVE_NODE", lat: coords?.lat ?? null, lon: coords?.lon ?? null },
      (res) => resolve(res ?? { nodeUrl: "http://localhost:3000", regionMissing: false })
    );
  });
  _nodeUrl = result.nodeUrl ?? "http://localhost:3000";
  _regionMissing = result.regionMissing === true && coords != null;
  console.log("[lens] resolved node →", _nodeUrl, _regionMissing ? "(no regional node)" : "");
  return _nodeUrl;
}

// ---------------------------------------------------------------------------
// Auto-popup setting — cached, reset on storage change
// ---------------------------------------------------------------------------

let _autoPopup = null;

async function getAutoPopup() {
  if (_autoPopup !== null) return _autoPopup;
  _autoPopup = await new Promise((resolve) =>
    chrome.storage.sync.get({ autoPopup: true }, (items) => resolve(items.autoPopup))
  );
  return _autoPopup;
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
  if ("autoPopup" in changes) _autoPopup = null;
  if ("wtToken" in changes) _authHeadersPromise = null;
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
// Hotel name extraction — for detail-page search fallback
// ---------------------------------------------------------------------------

function extractHotelName() {
  const og = document.querySelector('meta[property="og:title"]');
  const raw = (og?.getAttribute("content")?.trim() ?? document.title).trim();
  return raw
    // Strip site suffix:  "… | Booking.com"  or  "… – Booking.com"
    .replace(/\s*[|\u2013\u2014]\s*(Booking\.com|Expedia|Hotels\.com|Agoda).*$/i, "")
    // Booking.com og:title format: "Hotel Name, City, Country"
    // Drop everything from the first ", <word>" that looks like a location
    .replace(/,\s*[A-Z][^,]+.*$/, "")
    .trim();
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
      const res = await fetch(
        `${nodeUrl}/api/properties?q=${encodeURIComponent(q)}`,
        { signal: AbortSignal.timeout(6000), headers }
      );
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

function removeTooltip() {
  if (_tooltip) {
    _tooltip.remove();
    _tooltip = null;
  }
}

function showTooltip(anchorEl, facts, propertyName) {
  clearTimeout(_tooltipHideTimer);
  removeTooltip();

  _tooltip = document.createElement("div");
  _tooltip.id = "wt-lens-tooltip";
  _tooltip.style.cssText = `
    position: fixed;
    z-index: 2147483647;
    width: 280px;
    background: #fff;
    border: 2px solid #1e3a5f;
    border-radius: 12px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.18);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    font-size: 12px;
    color: #111827;
    overflow: hidden;
    pointer-events: none;
  `;

  const hdr = document.createElement("div");
  hdr.style.cssText =
    "background:#1e3a5f;color:#fff;padding:8px 12px;font-weight:700;font-size:12px;" +
    "white-space:nowrap;overflow:hidden;text-overflow:ellipsis";
  hdr.textContent = `\uD83C\uDF0D ${propertyName ?? "WikiTraveler"}`;
  _tooltip.appendChild(hdr);

  const bodyEl = document.createElement("div");
  bodyEl.style.cssText = "padding:8px 12px;max-height:200px;overflow-y:auto";

  if (!facts || facts.length === 0) {
    bodyEl.style.color = "#9ca3af";
    bodyEl.textContent = "No accessibility data yet.";
  } else {
    const table = document.createElement("table");
    table.style.cssText = "width:100%;border-collapse:collapse";
    facts.slice(0, 8).forEach((f) => {
      const row = document.createElement("tr");
      row.style.borderBottom = "1px solid #f3f4f6";
      row.innerHTML = `
        <td style="padding:4px 2px;color:#374151;font-weight:500">${f.fieldName.replace(/_/g, " ")}</td>
        <td style="padding:4px 2px">${f.value}</td>
      `;
      table.appendChild(row);
    });
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

async function handleCardEnter(card) {
  const nodeUrl = await getNodeUrl();
  const key = extractKeyFromCard(card);
  if (!key) return;

  clearTimeout(_hoverTimer);
  clearTimeout(_tooltipHideTimer);

  _hoverTimer = setTimeout(async () => {
    if (_cardCache.has(key)) {
      const cached = _cardCache.get(key);
      if (cached) showTooltip(card, cached.facts, cached.name);
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
      const res = await fetch(
        `${nodeUrl}/api/properties/${encodeURIComponent(propertyId)}/accessibility`,
        { signal: AbortSignal.timeout(6000), headers }
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
            const res2 = await fetch(
              `${nodeUrl}/api/properties/${encodeURIComponent(match.id)}/accessibility`,
              { signal: AbortSignal.timeout(6000), headers }
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
      if (card.matches(":hover")) showTooltip(card, entry.facts, entry.name);
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
  card.addEventListener("mouseenter", () => handleCardEnter(card));
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

  // 2. ?hotel= param — used by the StayWell Lens demo and similar agency sites
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
// Overlay injection
// ---------------------------------------------------------------------------

function createOverlay(facts, property) {
  // Only show overlay if we have facts
  if (!facts || facts.length === 0) {
    removeOverlay();
    return;
  }

  const existing = document.getElementById("wt-lens-overlay");
  if (existing) existing.remove();

  // Clamp width to viewport: 320px min, 420px max, 92vw on narrow screens
  const vw = window.innerWidth;
  const overlayW = Math.min(420, Math.max(320, vw * 0.92));
  const rightOffset = vw > 480 ? 20 : Math.round((vw - overlayW) / 2);
  const topOffset = vw > 480 ? 20 : 12;
  // Height: leave room for the header (~44px) and some breathing room
  const maxBodyH = Math.min(420, window.innerHeight - topOffset - 60);

  const overlay = document.createElement("div");
  overlay.id = "wt-lens-overlay";
  overlay.style.cssText = `
    position: fixed;
    top: ${topOffset}px;
    right: ${rightOffset}px;
    z-index: 2147483647;
    width: ${overlayW}px;
    background: #fff;
    border: 2px solid #1e3a5f;
    border-radius: 14px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.18);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    font-size: 13px;
    color: #111827;
    overflow: hidden;
  `;

  const header = document.createElement("div");
  header.style.cssText = `
    background: #1e3a5f;
    color: #fff;
    padding: 10px 14px;
    flex-shrink: 0;
  `;
  const nameHtml = property?.name
    ? `<div style="font-weight:700;font-size:14px;margin-bottom:${property.location ? 2 : 0}px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">🌍 ${property.name}</div>`
    : `<div style="font-weight:700;font-size:14px">🌍 WikiTraveler</div>`;
  const addressHtml = property?.location
    ? `<div style="font-size:11px;opacity:0.8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:2px">${property.location}</div>`
    : "";
  header.innerHTML = `
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">
      <div style="min-width:0;flex:1">${nameHtml}${addressHtml}</div>
      <button id="wt-close" style="background:none;border:none;color:#fff;cursor:pointer;font-size:18px;line-height:1;flex-shrink:0;padding:0">×</button>
    </div>
  `;

  const body = document.createElement("div");
  body.style.cssText = `padding: 10px 14px; max-height: ${maxBodyH}px; overflow-y: auto;`;

  // Quality summary dot
  const dotColor = qualityColor(facts);
  const verifiedCount = facts.filter((f) => f.tier === "CONFIRMED" || f.tier === "VERIFIED").length;
  const summaryText = verifiedCount > 0
    ? `${verifiedCount} field${verifiedCount > 1 ? "s" : ""} verified`
    : "AI / official data";
  body.innerHTML = `<p style="margin-bottom:8px;font-size:12px;color:#6b7280;display:flex;align-items:center;gap:6px"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${dotColor};flex-shrink:0"></span>${summaryText}</p>`;

  // Render facts as stacked rows
  facts.forEach((f) => {
    const item = document.createElement("div");
    item.style.cssText = `
      padding: 7px 0;
      border-bottom: 1px solid #f3f4f6;
    `;
    item.innerHTML = `
      <span style="font-weight:600;font-size:12px;color:#374151;display:block">
        ${f.fieldName.replace(/_/g, " ")}
      </span>
      <span style="font-size:12px;color:#111827">${f.value}</span>
    `;
    body.appendChild(item);
  });

  overlay.appendChild(header);
  overlay.appendChild(body);
  document.body.appendChild(overlay);

  document.getElementById("wt-close")?.addEventListener("click", () => removeOverlay());
}

function showLoginRequired() {
  const existing = document.getElementById("wt-lens-overlay");
  if (existing) existing.remove();

  const overlay = document.createElement("div");
  overlay.id = "wt-lens-overlay";
  overlay.style.cssText = `
    position: fixed; top: 20px; right: 20px; z-index: 2147483647;
    background: #1e3a5f; color: #fff; border-radius: 12px;
    padding: 12px 18px; font-family: sans-serif; font-size: 13px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.2); max-width: 260px;
  `;
  overlay.innerHTML = `
    <span style="font-weight:700">🌍 WikiTraveler</span><br>
    <span style="font-size:12px;opacity:0.85">Sign in via the extension popup to view accessibility data.</span>
    <button id="wt-close" style="position:absolute;top:8px;right:10px;background:none;border:none;color:#fff;cursor:pointer;font-size:16px">×</button>
  `;
  overlay.style.position = "fixed";
  document.body.appendChild(overlay);
  document.getElementById("wt-close")?.addEventListener("click", removeOverlay);

  // Auto-dismiss after 6 s
  setTimeout(removeOverlay, 6000);
}

function removeOverlay() {
  const existing = document.getElementById("wt-lens-overlay");
  if (existing) existing.remove();
}

function showLoading() {
  const existing = document.getElementById("wt-lens-overlay");
  if (existing) existing.remove();

  const overlay = document.createElement("div");
  overlay.id = "wt-lens-overlay";
  overlay.style.cssText = `
    position: fixed; top: 20px; right: 20px; z-index: 2147483647;
    background: #1e3a5f; color: #fff; border-radius: 12px;
    padding: 10px 18px; font-family: sans-serif; font-size: 13px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.2);
  `;
  overlay.textContent = "🌍 WikiTraveler loading…";
  document.body.appendChild(overlay);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function run() {
  const thisRunId = ++_runId;
  const nodeUrl = await getNodeUrl();
  if (thisRunId !== _runId) return; // superseded by a newer run

  if (_regionMissing) {} // regional warning shown in popup only
  // ---- Listing page: attach hover tooltips to hotel cards ----
  if (isListingPage()) {
    removeOverlay();
    startListingMode();
    return;
  }

  stopListingMode();

  // Respect the "auto-show overlay" setting — if disabled the user opens
  // data manually via the WikiTraveler toolbar icon (popup).
  if (!(await getAutoPopup())) return;

  const propertyId = extractPropertyId();
  const headers = await getAuthHeaders();

  // ---- Detail page: search fallback when ID extraction failed ----
  if (propertyId.startsWith("page-")) {
    const name = extractHotelName();
    if (name) {
      showLoading();
      const coords = extractCoordinates();
      const { match } = await searchForProperty(name, nodeUrl, coords, headers);
      if (thisRunId !== _runId) return;
      if (match) {
        try {
          const res = await fetch(
            `${nodeUrl}/api/properties/${encodeURIComponent(match.id)}/accessibility`,
            { signal: AbortSignal.timeout(8000), headers }
          );
          if (res.status === 401 || res.status === 403) {
            _authHeadersPromise = null;
            showLoginRequired();
            return;
          }
          if (res.ok) {
            const data = await res.json();
            const facts = data.facts ?? [];
            if (thisRunId !== _runId) return;
            if (facts.length > 0) {
              createOverlay(facts, data.property);
              return;
            }
          }
        } catch {
          // fall through to removeOverlay
        }
      }
    }
    if (thisRunId !== _runId) return;
    removeOverlay();
    return;
  }

  // ---- Detail page: direct ID lookup, with name-search fallback on 404 ----
  showLoading();

  try {
    const res = await fetch(
      `${nodeUrl}/api/properties/${encodeURIComponent(propertyId)}/accessibility`,
      { signal: AbortSignal.timeout(8000), headers }
    );

    if (res.status === 401 || res.status === 403) {
      _authHeadersPromise = null;
      showLoginRequired();
      return;
    }

    if (res.status === 404) {
      // ID not in node — try matching by hotel name instead
      const name = extractHotelName();
      if (name) {
        const coords = extractCoordinates();
        const { match } = await searchForProperty(name, nodeUrl, coords, headers);
        if (thisRunId !== _runId) return;
        if (match) {
          const res2 = await fetch(
            `${nodeUrl}/api/properties/${encodeURIComponent(match.id)}/accessibility`,
            { signal: AbortSignal.timeout(8000), headers }
          );
          if (res2.ok) {
            const data2 = await res2.json();
            const facts2 = data2.facts ?? [];
            if (thisRunId !== _runId) return;
            if (facts2.length > 0) {
              createOverlay(facts2, data2.property);
              return;
            }
          }
        }
      }
      if (thisRunId !== _runId) return;
      removeOverlay();
      return;
    }

    if (!res.ok) {
      if (thisRunId !== _runId) return;
      removeOverlay();
      return;
    }

    const data = await res.json();
    const facts = data.facts ?? [];
    if (thisRunId !== _runId) return;
    if (facts.length > 0) {
      createOverlay(facts, data.property);
    } else {
      removeOverlay();
    }
  } catch {
    if (thisRunId !== _runId) return;
    removeOverlay();
  }
}

// Debounce to avoid firing on every navigation fragment change
let runTimer;
let _runId = 0;
let _lastScheduledUrl = "";

function scheduleRun() {
  clearTimeout(runTimer);

  // Only clear the overlay when the page URL actually changed.
  // Booking.com fires spurious popstate events during SPA init which would
  // otherwise wipe an overlay that was just rendered.
  const currentUrl = location.href;
  if (currentUrl !== _lastScheduledUrl) {
    _lastScheduledUrl = currentUrl;
    removeOverlay();
  }

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
