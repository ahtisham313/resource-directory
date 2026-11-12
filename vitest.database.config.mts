import { defineConfig } from "vitest/config";
import baseConfig from "./vitest.config.mjs";

export default defineConfig({
  ...baseConfig,
  test: {
    ...baseConfig.test,
    include: ["tests/**/*.integration.test.ts"],
    exclude: [],
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
