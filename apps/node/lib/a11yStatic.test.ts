/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it } from "vitest";
import axe from "axe-core";

async function runAxe(html: string) {
  document.body.innerHTML = html;
  const results = await axe.run(document.body, {
    rules: {
      "color-contrast": { enabled: false },
    },
  });
  return results.violations;
}

describe("accessibility static HTML", () => {
  it("login form sample has no critical axe violations", async () => {
    const violations = await runAxe(`
      <form>
        <label for="login-username">Username</label>
        <input id="login-username" type="text" autocomplete="username" />
        <label for="login-password">Password</label>
        <input id="login-password" type="password" autocomplete="current-password" />
        <button type="submit">Sign in</button>
        <p role="alert" hidden></p>
      </form>
    `);
    const critical = violations.filter((v) => v.impact === "critical" || v.impact === "serious");
    expect(critical).toEqual([]);
  });

  it("map property list sample is keyboard accessible", async () => {
    const violations = await runAxe(`
      <button type="button" aria-expanded="false" aria-controls="map-property-list">Show list</button>
      <ul id="map-property-list">
        <li><a href="/properties/1">Hotel A</a></li>
      </ul>
    `);
    const critical = violations.filter((v) => v.impact === "critical" || v.impact === "serious");
    expect(critical).toEqual([]);
  });

  it("SDK widget table sample has scoped headers", async () => {
    const violations = await runAxe(`
      <div role="region" aria-label="WikiTraveler accessibility data">
        <table>
          <thead>
            <tr>
              <th scope="col">Feature</th>
              <th scope="col">Value</th>
              <th scope="col">Trust</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>Step-free entrance</td><td>Yes</td><td><span aria-label="Trust tier: Verified">Verified</span></td></tr>
          </tbody>
        </table>
      </div>
    `);
    const critical = violations.filter((v) => v.impact === "critical" || v.impact === "serious");
    expect(critical).toEqual([]);
  });

  it("agency demo snippet tabs follow tab pattern", async () => {
    const violations = await runAxe(`
      <div role="tablist" aria-label="Integration snippets">
        <button type="button" role="tab" aria-selected="true" aria-controls="tab-widget" id="tab-btn-widget">Widget</button>
        <button type="button" role="tab" aria-selected="false" aria-controls="tab-fetch" tabindex="-1" id="tab-btn-fetch">Fetch</button>
      </div>
      <div id="tab-widget" role="tabpanel" aria-labelledby="tab-btn-widget">Panel</div>
      <div id="tab-fetch" role="tabpanel" aria-labelledby="tab-btn-fetch" hidden>Panel</div>
    `);
    const critical = violations.filter((v) => v.impact === "critical" || v.impact === "serious");
    expect(critical).toEqual([]);
  });

  it("lens facts table sample has column headers", async () => {
    const violations = await runAxe(`
      <table>
        <thead>
          <tr>
            <th scope="col">Feature</th>
            <th scope="col">Value</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>Ramp present</td><td>Yes</td></tr>
        </tbody>
      </table>
    `);
    const critical = violations.filter((v) => v.impact === "critical" || v.impact === "serious");
    expect(critical).toEqual([]);
  });

  it("registration closed message sample is accessible", async () => {
    const violations = await runAxe(`
      <main>
        <h1>Create account</h1>
        <p>Registration is closed on this node. Contact an admin for an account.</p>
        <p><a href="/login">Sign in</a></p>
      </main>
    `);
    const critical = violations.filter((v) => v.impact === "critical" || v.impact === "serious");
    expect(critical).toEqual([]);
  });

  it("region not configured banner sample is accessible", async () => {
    const violations = await runAxe(`
      <div role="status">
        No region configured yet.
        <a href="/stats">Admin: configure region</a>
      </div>
    `);
    const critical = violations.filter((v) => v.impact === "critical" || v.impact === "serious");
    expect(critical).toEqual([]);
  });
});
