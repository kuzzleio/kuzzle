import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["lcov"],
      reportsDirectory: "./coverage",
    },
    environment: "node",
    globals: true,
    hookTimeout: 20000,
    root: "tests",
    testTimeout: 20000,
  },
});
