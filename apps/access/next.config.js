/** @type {import('next').NextConfig} */
const path = require("path");
const rootPkg = require("../../package.json");
try {
  require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });
} catch {
  // dotenv optional — Docker / CI inject NEXT_PUBLIC_* at build time
}

const nextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION:
      process.env.WIKITRAVELER_VERSION ?? rootPkg.version,
  },
  transpilePackages: ["@wikitraveler/core", "@wikitraveler/ui", "@ionic/react"],
  output: "standalone",
  onDemandEntries: {
    maxInactiveAge: 60 * 1000,
    pagesBufferLength: 2,
  },
  async rewrites() {
    const nodeTarget = process.env.NEXT_PUBLIC_NODE_API_URL ?? "http://localhost:3000";
    return [
      {
        source: "/node-api/:path*",
        destination: `${nodeTarget.replace(/\/$/, "")}/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
