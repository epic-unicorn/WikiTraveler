const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Required for Docker standalone output — copies only what's needed to run
  output: "standalone",
  // Enable the instrumentation hook (runs bootstrapPeers on startup)
  experimental: {
    instrumentationHook: true,
  },
  // Allow cross-origin requests from the browser-side SDK
  async headers() {
    const corsOrigins = process.env.CORS_ORIGINS ?? "*";
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: corsOrigins },
          { key: "Access-Control-Allow-Methods", value: "GET,POST,OPTIONS" },
          {
            key: "Access-Control-Allow-Headers",
            value: "Content-Type, Authorization",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
