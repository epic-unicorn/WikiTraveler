/** @type {import('next').NextConfig} */
const path = require("path");
try {
  require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });
} catch {
  // dotenv optional — Docker / CI inject NEXT_PUBLIC_* at build time
}

const nextConfig = {
  transpilePackages: ["@wikitraveler/ui", "@wikitraveler/core", "@ionic/react"],
  output: "standalone",
};

module.exports = nextConfig;
