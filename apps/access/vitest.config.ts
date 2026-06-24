import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    restoreMocks: true,
    clearMocks: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      "@wikitraveler/core": path.resolve(__dirname, "../../packages/core/src/index.ts"),
      "@wikitraveler/ui": path.resolve(__dirname, "../../packages/ui/src/index.ts"),
    },
  },
});
