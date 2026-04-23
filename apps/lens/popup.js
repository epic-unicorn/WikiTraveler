// popup.js

async function searchForProperty(name, nodeUrl, coords) {
  const words = name.split(/\s+/);
  let bestCandidates = null;

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
      // 2. Stored name is a unique prefix of the extracted name
      const prefixMatches = results.filter((p) => lower.startsWith(p.name.toLowerCase()));
      if (prefixMatches.length === 1) return prefixMatches[0];

      if (!bestCandidates) bestCandidates = results;
      break;
    } catch {
      // network error on this attempt, try shorter
    }
  }

  if (!bestCandidates) return null;

  // Use coordinates to pick the closest candidate
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
  // Ask content script for og:title via GET_PROPERTY_ID message isn't enough —
  // we derive the name from the tab title which Chrome exposes.
  const title = tab.title ?? "";
  return title
    .replace(/\s*[|\u2013\u2014]\s*(Booking\.com|Expedia|Hotels\.com|Agoda).*$/i, "")
    .replace(/,\s*[A-Z][^,]+.*$/, "")
    .trim();
}

async function init() {
  const content = document.getElementById("content");

  // Get active tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tab?.url ?? "";

  // Show username@node in header if stored
  chrome.storage.sync.get({ nodeUrl: "http://localhost:3000", wtUsername: "" }, (items) => {
    const userLine = document.getElementById("user-line");
    if (userLine && items.wtUsername) {
      try {
        const host = new URL(items.nodeUrl).hostname;
        userLine.textContent = `${items.wtUsername}@${host}`;
      } catch { /* ignore */ }
    }
  });

  // Ask content script for coordinates, then resolve the best node via peers
  let coords = null;
  try {
    const coordRes = await chrome.tabs.sendMessage(tab.id, { type: "GET_COORDS" });
    if (coordRes?.lat != null && coordRes?.lon != null) coords = coordRes;
  } catch { /* content script not injected on this page */ }

  const { nodeUrl, regionMissing } = await new Promise((resolve) =>
    chrome.runtime.sendMessage(
      { type: "RESOLVE_NODE", lat: coords?.lat ?? null, lon: coords?.lon ?? null },
      (res) => resolve(res ?? { nodeUrl: "http://localhost:3000", regionMissing: false })
    )
  );

  // Show regional warning if no bbox-matched node was found
  if (regionMissing && coords != null) {
    const banner = document.createElement("div");
    banner.style.cssText = `
      background:#fef3c7;color:#92400e;font-size:12px;padding:8px 16px;
      border-bottom:1px solid #fde68a;display:flex;gap:8px;align-items:flex-start;
    `;
    banner.innerHTML = `<span>⚠️</span><span>No regional node available for this location. Data may be from another region.</span>`;
    document.querySelector("header").after(banner);
  }

  // Try to get property ID from the content script first (handles meta tags)
  let propertyId = "unknown";
  try {
    const response = await chrome.tabs.sendMessage(tab.id, { type: "GET_PROPERTY_ID" });
    if (response?.propertyId) {
      propertyId = response.propertyId;
    }
  } catch {
    // Content script not available, fall back to URL heuristics
    const bookingQuery = new URLSearchParams(new URL(url).search).get("hotelid");
    if (bookingQuery) propertyId = `booking-${bookingQuery}`;
    else {
      const bookingPath = url.match(/booking\.com\/hotel\/[^/]+\/([^.?#]+)/);
      if (bookingPath) propertyId = `booking-${bookingPath[1]}`;
      const expediaMatch = url.match(/\/h(\d+)\.Hotel/i);
      if (expediaMatch) propertyId = `expedia-${expediaMatch[1]}`;
    }
  }

  content.innerHTML = `
    <p class="property-id">Property: ${propertyId}</p>
    <p style="color:#9ca3af;font-size:12px">Fetching from <code>${nodeUrl}</code>…</p>`;

  async function fetchAndRender(resolvedId, displayId) {
    const res = await fetch(
      `${nodeUrl}/api/properties/${encodeURIComponent(resolvedId)}/accessibility`,
      { signal: AbortSignal.timeout(6000) }
    );

    if (res.status === 404) {
      // Try name-search fallback using the tab title
      const name = extractHotelNameFromTab(tab);
      if (name) {
        const match = await searchForProperty(name, nodeUrl, coords);
        if (match) {
          return fetchAndRender(match.id, match.name);
        }
      }
      content.innerHTML = `
        <p class="property-id">Property: ${displayId}</p>
        <p class="empty">No data found for this property.<br>
          <a href="${nodeUrl}" target="_blank">Open node →</a></p>`;
      return;
    }

    if (!res.ok) {
      content.innerHTML = `
        <p class="property-id">Property: ${displayId}</p>
        <p class="empty">No data found for this property.<br>
          <a href="${nodeUrl}" target="_blank">Open node →</a></p>`;
      return;
    }

    const data = await res.json();
    const facts = data.facts ?? [];
    const prop = data.property;

    const propNameHtml = prop?.name
      ? `<p style="font-weight:700;font-size:13px;margin:0 0 2px">${prop.name}</p>`
      : "";
    const propAddressHtml = prop?.location
      ? `<p style="font-size:11px;color:#6b7280;margin:0 0 10px">${prop.location}</p>`
      : "";
    const propHeader = propNameHtml || propAddressHtml
      ? `${propNameHtml}${propAddressHtml}`
      : `<p class="property-id">Property: ${displayId}</p>`;

    if (facts.length === 0) {
      content.innerHTML = `
        ${propHeader}
        <p class="empty">No accessibility facts yet.<br>Use the Field Kit to submit an audit.</p>`;
      return;
    }

    let html = `${propHeader}<table><tbody>`;
    for (const f of facts) {
      html += `
        <tr>
          <td style="font-weight:500;color:#374151">${f.fieldName.replace(/_/g, " ")}</td>
          <td>${f.value}</td>
        </tr>`;
    }
    html += `</tbody></table>
      <p style="font-size:11px;color:#9ca3af;margin-top:10px">
        <a href="${nodeUrl}/properties/${resolvedId}" target="_blank">View full report →</a>
      </p>`;
    content.innerHTML = html;
  }

  try {
    await fetchAndRender(propertyId, propertyId);
  } catch {
    content.innerHTML = `<p class="empty">Could not reach node.<br>
      <a href="options.html">Check settings →</a></p>`;
  }
}

init();
