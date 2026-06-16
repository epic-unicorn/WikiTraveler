const fs = require("fs");
const path = require("path");

let propertyId = "unknown";
try {
  const secrets = JSON.parse(
    fs.readFileSync(path.join(__dirname, ".lighthouse-secrets.json"), "utf8")
  );
  propertyId = secrets.propertyId ?? propertyId;
} catch {
  // prepare-lighthouse.mjs writes this file before collect
}

/** @type {import('@lhci/cli').LHCI.ServerCommand.Options} */
module.exports = {
  ci: {
    collect: {
      numberOfRuns: 1,
      url: [
        "http://localhost:3000/accessibility",
        "http://localhost:3000/login",
        "http://localhost:3000/",
        "http://localhost:3001/login",
        `http://localhost:3001/audit/${propertyId}`,
      ],
      puppeteerScript: "./scripts/lhci-auth.cjs",
      puppeteerLaunchOptions: {
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      },
      settings: {
        onlyCategories: ["accessibility"],
      },
    },
    assert: {
      assertions: {
        "categories:accessibility": ["error", { minScore: 0.9 }],
      },
    },
    upload: {
      target: "filesystem",
      outputDir: "./.lighthouseci",
    },
  },
};
