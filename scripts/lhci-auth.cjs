/**
 * Injects wt_token cookies before Lighthouse navigates to authenticated routes.
 * Requires .lighthouse-secrets.json from scripts/prepare-lighthouse.mjs.
 *
 * @param {import("puppeteer").Browser} browser
 * @param {{ url: string }} context
 */
const fs = require("fs");
const path = require("path");

const AUTH_ORIGINS = ["http://localhost:3000", "http://localhost:3001"];

module.exports = async (browser, context) => {
  const secretsPath = path.join(process.cwd(), ".lighthouse-secrets.json");
  if (!fs.existsSync(secretsPath)) return;

  const { token } = JSON.parse(fs.readFileSync(secretsPath, "utf8"));
  if (!token) return;

  const page = await browser.newPage();
  try {
    for (const url of AUTH_ORIGINS) {
      await page.setCookie({
        name: "wt_token",
        value: token,
        url,
        path: "/",
        httpOnly: false,
        secure: false,
        sameSite: "Lax",
      });
    }
  } finally {
    await page.close();
  }

  void context;
};
