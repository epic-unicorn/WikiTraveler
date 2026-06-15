/**
 * Injects wt_token cookies before Lighthouse navigates to authenticated routes.
 * Requires .lighthouse-secrets.json from scripts/prepare-lighthouse.mjs.
 */
const fs = require("fs");
const path = require("path");

module.exports = async (page, context) => {
  const secretsPath = path.join(process.cwd(), ".lighthouse-secrets.json");
  if (!fs.existsSync(secretsPath)) return;

  const { token } = JSON.parse(fs.readFileSync(secretsPath, "utf8"));
  if (!token) return;

  const port = new URL(context.url).port;
  await page.setCookie({
    name: "wt_token",
    value: token,
    domain: "localhost",
    path: "/",
    httpOnly: false,
    secure: false,
    sameSite: "Lax",
  });

  // Field Kit and Node share the same JWT cookie name on localhost (different ports).
  void port;
};
