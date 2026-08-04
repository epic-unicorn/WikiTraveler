import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.test.ts", "../../packages/core/src/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/.next/**"],
    restoreMocks: true,
    clearMocks: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      "@wikitraveler/core": path.resolve(__dirname, "../../packages/core/src/index.ts"),
      "@wikitraveler/i18n": path.resolve(__dirname, "../../packages/i18n/src/index.ts"),
      "@wikitraveler/ai-agent": path.resolve(__dirname, "../../packages/ai-agent/src/index.ts"),
      "@wikitraveler/ui": path.resolve(__dirname, "../../packages/ui/src/index.ts"),
    },
  },
});
