// popup.js

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

  const { nodeUrl } = await new Promise((resolve) =>
    chrome.storage.sync.get({ nodeUrl: "http://localhost:3000" }, resolve)
  );

  // Get active tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tab?.url ?? "";

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
        const match = await searchForProperty(name, nodeUrl);
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
      const color = TIER_COLOR[f.tier] ?? "#9ca3af";
      const label = TIER_LABEL[f.tier] ?? f.tier;
      html += `
        <tr>
          <td style="font-weight:500;color:#374151">${f.fieldName.replace(/_/g, " ")}</td>
          <td>${f.value}</td>
          <td><span class="badge" style="background:${color}">${label}</span></td>
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
