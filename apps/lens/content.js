// content.js — injected into booking pages

const TIER_COLOR = {
  OFFICIAL: "#9ca3af",
  AI_GUESS: "#fbbf24",
  VERIFIED: "#34d399",
  CONFIRMED: "#60a5fa",
};

const TIER_LABEL = {
  OFFICIAL: "Official",
  AI_GUESS: "AI Estimate",
  VERIFIED: "Verified ✓",
  CONFIRMED: "Confirmed ✓✓✓",
};

const SOURCE_COLOR = {
  AMADEUS: "#6366f1",
  WHEELMAP: "#0ea5e9",
  WHEEL_THE_WORLD: "#f97316",
  AUDITOR: "#10b981",
};

const SOURCE_LABEL = {
  AMADEUS: "Amadeus",
  WHEELMAP: "Wheelmap ♿",
  WHEEL_THE_WORLD: "WtW",
  AUDITOR: "Field Audit",
};

// ---------------------------------------------------------------------------
// Node URL — fetched once from storage and cached for the page lifetime
// ---------------------------------------------------------------------------

let _nodeUrl = null;

async function getNodeUrl() {
  if (_nodeUrl) return _nodeUrl;
  _nodeUrl = await new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "GET_NODE_URL" }, (res) =>
      resolve(res?.nodeUrl ?? "http://localhost:3000")
    );
  });
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

// Invalidate cache when the user changes settings
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && "autoPopup" in changes) {
    _autoPopup = null;
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

async function searchForProperty(name, nodeUrl) {
  const words = name.split(/\s+/);
  // Retry with progressively shorter queries so a stored name like "NH Collection"
  // is found even when the extracted name is "NH Collection Eindhoven Centre".
  for (let len = words.length; len >= 2; len--) {
    const q = words.slice(0, len).join(" ");
    try {
      const res = await fetch(
        `${nodeUrl}/api/properties?q=${encodeURIComponent(q)}`,
        { signal: AbortSignal.timeout(6000) }
      );
      if (!res.ok) continue;
      const data = await res.json();
      const results = data.properties ?? [];
      if (results.length === 0) continue;
      const lower = name.toLowerCase();
      // 1. Exact match
      const exact = results.find((p) => p.name.toLowerCase() === lower);
      if (exact) return exact;
      // 2. Stored name is a prefix of the extracted name
      const prefix = results.find((p) => lower.startsWith(p.name.toLowerCase()));
      if (prefix) return prefix;
      // 3. Single result
      if (results.length === 1) return results[0];
      // Multiple ambiguous results — keep trying a shorter query
    } catch {
      // network error on this attempt, try shorter
    }
  }
  return null;
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
        <td style="padding:4px 2px">
          <span style="background:${TIER_COLOR[f.tier] ?? "#9ca3af"};color:#fff;border-radius:999px;padding:1px 6px;font-size:10px;font-weight:700">${TIER_LABEL[f.tier] ?? f.tier}</span>
        </td>
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

    if (key.startsWith("name:")) {
      const name = key.slice(5);
      const match = await searchForProperty(name, nodeUrl);
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
        { signal: AbortSignal.timeout(6000) }
      );

      if (res.status === 404 && !key.startsWith("name:")) {
        // Not in node by booking ID — retry by hotel name from the card heading
        const heading = card.querySelector('[data-testid="title"], h3, h2, .sr_item_content h3');
        const headingName = heading?.textContent?.trim();
        if (headingName) {
          const match = await searchForProperty(headingName, nodeUrl);
          if (match) {
            const res2 = await fetch(
              `${nodeUrl}/api/properties/${encodeURIComponent(match.id)}/accessibility`,
              { signal: AbortSignal.timeout(6000) }
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

  // Show top tier badge first
  const topTier = facts.reduce((best, f) => {
    const tierOrder = { OFFICIAL: 0, AI_GUESS: 1, VERIFIED: 2, CONFIRMED: 3 };
    return (tierOrder[f.tier] ?? 0) > (tierOrder[best.tier] ?? 0) ? f : best;
  }, facts[0]);

  const tierBadge = `<span style="background:${TIER_COLOR[topTier.tier] ?? "#9ca3af"};color:#fff;border-radius:999px;padding:2px 10px;font-size:11px;font-weight:700">${TIER_LABEL[topTier.tier] ?? topTier.tier}</span>`;
  body.innerHTML = `<p style="margin-bottom:8px;font-size:12px;color:#6b7280">Highest trust level: ${tierBadge}</p>`;

  // Render facts as stacked rows instead of a 4-column table so long
  // field names, values and badges all wrap naturally at any width.
  facts.forEach((f) => {
    const item = document.createElement("div");
    item.style.cssText = `
      display: grid;
      grid-template-columns: 1fr auto;
      grid-template-rows: auto auto;
      column-gap: 8px;
      row-gap: 2px;
      padding: 7px 0;
      border-bottom: 1px solid #f3f4f6;
    `;
    const tierColor = TIER_COLOR[f.tier] ?? "#9ca3af";
    const srcColor  = SOURCE_COLOR[f.sourceType] ?? "#9ca3af";
    item.innerHTML = `
      <span style="font-weight:600;font-size:12px;color:#374151;word-break:break-word">
        ${f.fieldName.replace(/_/g, " ")}
      </span>
      <span style="display:flex;gap:4px;align-items:flex-start;justify-content:flex-end;flex-wrap:wrap;min-width:0">
        <span style="background:${tierColor};color:#fff;border-radius:999px;padding:1px 7px;font-size:10px;font-weight:700;white-space:nowrap">${TIER_LABEL[f.tier] ?? f.tier}</span>
        <span style="background:${srcColor};color:#fff;border-radius:999px;padding:1px 7px;font-size:10px;font-weight:700;white-space:nowrap">${SOURCE_LABEL[f.sourceType] ?? (f.sourceType ?? "")}</span>
      </span>
      <span style="font-size:12px;color:#111827;grid-column:1/-1;word-break:break-word">${f.value}</span>
    `;
    body.appendChild(item);
  });

  overlay.appendChild(header);
  overlay.appendChild(body);
  document.body.appendChild(overlay);

  document.getElementById("wt-close")?.addEventListener("click", () => removeOverlay());
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

  // ---- Detail page: search fallback when ID extraction failed ----
  if (propertyId.startsWith("page-")) {
    const name = extractHotelName();
    if (name) {
      showLoading();
      const match = await searchForProperty(name, nodeUrl);
      if (thisRunId !== _runId) return;
      if (match) {
        try {
          const res = await fetch(
            `${nodeUrl}/api/properties/${encodeURIComponent(match.id)}/accessibility`,
            { signal: AbortSignal.timeout(8000) }
          );
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
      { signal: AbortSignal.timeout(8000) }
    );

    if (res.status === 404) {
      // ID not in node — try matching by hotel name instead
      const name = extractHotelName();
      if (name) {
        const match = await searchForProperty(name, nodeUrl);
        if (thisRunId !== _runId) return;
        if (match) {
          const res2 = await fetch(
            `${nodeUrl}/api/properties/${encodeURIComponent(match.id)}/accessibility`,
            { signal: AbortSignal.timeout(8000) }
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
