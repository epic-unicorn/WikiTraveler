import { defineConfig } from "tsup";

/** Bundle workspace deps so the npm package is self-contained. */
const noExternal = ["@wikitraveler/core", "@wikitraveler/i18n"];

export default defineConfig([
  {
    entry: ["src/index.ts"],
    format: ["cjs", "esm"],
    dts: true,
    outDir: "dist",
    clean: true,
    noExternal,
  },
  {
    entry: { wikitraveler: "src/index.ts" },
    format: ["iife"],
    globalName: "WikiTraveler",
    outDir: "dist",
    outExtension: () => ({ js: ".umd.js" }),
    noExternal,
  },
]);
