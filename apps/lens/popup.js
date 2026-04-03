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

  try {
    const res = await fetch(
      `${nodeUrl}/api/properties/${encodeURIComponent(propertyId)}/accessibility`,
      { signal: AbortSignal.timeout(6000) }
    );

    if (!res.ok) {
      content.innerHTML = `
        <p class="property-id">Property: ${propertyId}</p>
        <p class="empty">No data found for this property.<br>
          <a href="${nodeUrl}" target="_blank">Open node →</a></p>`;
      return;
    }

    const data = await res.json();
    const facts = data.facts ?? [];

    if (facts.length === 0) {
      content.innerHTML = `
        <p class="property-id">Property: ${propertyId}</p>
        <p class="empty">No accessibility facts yet.<br>Use the Field Kit to submit an audit.</p>`;
      return;
    }

    let html = `<p class="property-id">Property: ${propertyId}</p>
      <table><tbody>`;
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
        <a href="${nodeUrl}/properties/${propertyId}" target="_blank">View full report →</a>
      </p>`;
    content.innerHTML = html;
  } catch {
    content.innerHTML = `<p class="empty">Could not reach node.<br>
      <a href="options.html">Check settings →</a></p>`;
  }
}

init();
