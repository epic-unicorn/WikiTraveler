const path = require("path");
const rootPkg = require("../../package.json");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    WIKITRAVELER_VERSION:
      process.env.WIKITRAVELER_VERSION ?? rootPkg.version,
  },
  transpilePackages: ["@wikitraveler/ui"],
  // Required for Docker standalone output — copies only what's needed to run
  output: "standalone",
  // pnpm stores Prisma engines outside the default trace path
  outputFileTracingIncludes: {
    "/*": [
      "./node_modules/.pnpm/@prisma+client*/node_modules/.prisma/client/**",
      "../../node_modules/.pnpm/@prisma+client*/node_modules/.prisma/client/**",
    ],
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
