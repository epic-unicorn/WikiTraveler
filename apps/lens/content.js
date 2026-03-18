// content.js — injected into booking pages

const TIER_COLOR = {
  OFFICIAL: "#9ca3af",
  AI_GUESS: "#fbbf24",
  COMMUNITY: "#34d399",
  MESH_TRUTH: "#60a5fa",
};

const TIER_LABEL = {
  OFFICIAL: "Official",
  AI_GUESS: "AI Estimate",
  COMMUNITY: "Community Verified",
  MESH_TRUTH: "Mesh Truth",
};

// ---------------------------------------------------------------------------
// Property ID extraction — heuristics for supported sites
// ---------------------------------------------------------------------------

function extractPropertyId() {
  const url = window.location.href;

  // Booking.com: /hotel/country/property-name.en-gb.html or query param hotelid=
  const bookingQuery = new URLSearchParams(window.location.search).get("hotelid");
  if (bookingQuery) return `booking-${bookingQuery}`;

  const bookingPath = url.match(/booking\.com\/hotel\/[^/]+\/([^.?#]+)/);
  if (bookingPath) return `booking-${bookingPath[1]}`;

  // Expedia / Hotels.com: /h{ID}.Hotel-Information
  const expediaMatch = url.match(/\/h(\d+)\.Hotel/i);
  if (expediaMatch) return `expedia-${expediaMatch[1]}`;

  // Fallback: use document title
  const titleSlug = document.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 60);
  return `page-${titleSlug}`;
}

// ---------------------------------------------------------------------------
// Overlay injection
// ---------------------------------------------------------------------------

function createOverlay(facts) {
  const existing = document.getElementById("wt-lens-overlay");
  if (existing) existing.remove();

  const overlay = document.createElement("div");
  overlay.id = "wt-lens-overlay";
  overlay.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 2147483647;
    width: 300px;
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
    display: flex;
    align-items: center;
    justify-content: space-between;
  `;
  header.innerHTML = `
    <span style="font-weight:700;font-size:14px">🌍 WikiTraveler</span>
    <button id="wt-close" style="background:none;border:none;color:#fff;cursor:pointer;font-size:18px;line-height:1">×</button>
  `;

  const body = document.createElement("div");
  body.style.cssText = "padding: 12px 14px; max-height: 320px; overflow-y: auto;";

  if (!facts || facts.length === 0) {
    body.innerHTML = `<p style="color:#9ca3af;text-align:center;padding:16px 0">No accessibility data found for this property.<br><br><small>Help the community by <a href="#" style="color:#1e3a5f">submitting an audit</a>.</small></p>`;
  } else {
    // Show top tier badge first
    const topTier = facts.reduce((best, f) => {
      const tierOrder = { OFFICIAL: 0, AI_GUESS: 1, COMMUNITY: 2, MESH_TRUTH: 3 };
      return (tierOrder[f.tier] ?? 0) > (tierOrder[best.tier] ?? 0) ? f : best;
    }, facts[0]);

    const tierBadge = `<span style="background:${TIER_COLOR[topTier.tier] ?? "#9ca3af"};color:#fff;border-radius:999px;padding:2px 10px;font-size:11px;font-weight:700">${TIER_LABEL[topTier.tier] ?? topTier.tier}</span>`;
    body.innerHTML = `<p style="margin-bottom:10px;font-size:12px;color:#6b7280">Highest trust level: ${tierBadge}</p>`;

    const table = document.createElement("table");
    table.style.cssText = "width:100%;border-collapse:collapse";
    facts.forEach((f) => {
      const row = document.createElement("tr");
      row.style.borderBottom = "1px solid #f3f4f6";
      row.innerHTML = `
        <td style="padding:6px 4px;color:#374151;font-weight:500;font-size:12px">${f.fieldName.replace(/_/g, " ")}</td>
        <td style="padding:6px 4px;font-size:12px">${f.value}</td>
        <td style="padding:6px 4px">
          <span style="background:${TIER_COLOR[f.tier] ?? "#9ca3af"};color:#fff;border-radius:999px;padding:1px 7px;font-size:10px;font-weight:700">${TIER_LABEL[f.tier] ?? f.tier}</span>
        </td>
      `;
      table.appendChild(row);
    });
    body.appendChild(table);
  }

  overlay.appendChild(header);
  overlay.appendChild(body);
  document.body.appendChild(overlay);

  document.getElementById("wt-close")?.addEventListener("click", () => overlay.remove());
}

function showLoading() {
  const existing = document.getElementById("wt-lens-overlay");
  if (existing) existing.remove();

  const overlay = document.createElement("div");
  overlay.id = "wt-lens-overlay";
  overlay.style.cssText = `
    position: fixed; bottom: 20px; right: 20px; z-index: 2147483647;
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
  // Ask background script for the node URL (from storage)
  const { nodeUrl } = await new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "GET_NODE_URL" }, resolve);
  });

  const propertyId = extractPropertyId();
  showLoading();

  try {
    const res = await fetch(
      `${nodeUrl}/api/properties/${encodeURIComponent(propertyId)}/accessibility`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) {
      createOverlay(null);
      return;
    }
    const data = await res.json();
    createOverlay(data.facts ?? []);
  } catch {
    createOverlay(null);
  }
}

// Debounce to avoid firing on every navigation fragment change
let runTimer;
function scheduleRun() {
  clearTimeout(runTimer);
  runTimer = setTimeout(run, 800);
}

scheduleRun();

// Re-run on SPA navigations
const _pushState = history.pushState.bind(history);
history.pushState = (...args) => { _pushState(...args); scheduleRun(); };
window.addEventListener("popstate", scheduleRun);
