import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: ["src/index.ts"],
    format: ["cjs", "esm"],
    dts: true,
    outDir: "dist",
    clean: true,
  },
  {
    entry: { wikitraveler: "src/index.ts" },
    format: ["iife"],
    globalName: "WikiTraveler",
    outDir: "dist",
    outExtension: () => ({ js: ".umd.js" }),
  },
]);
