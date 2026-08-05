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
  // CORS for /api/* is applied dynamically in middleware (trusted Origin reflection).
  // See apps/node/lib/corsOrigins.ts and RFC-0002.
};

module.exports = nextConfig;
