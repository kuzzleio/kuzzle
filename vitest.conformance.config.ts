import { defineConfig } from "vitest/config";

// The storage driver conformance kit run against the built-in drivers
// (ADR-0003 step 04). Apart from the unit suite: it needs a real
// Elasticsearch. See tests/conformance/builtInDrivers.conformance.ts.
export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["lcov"],
      reportsDirectory: "coverage/conformance",
    },
    environment: "node",
    hookTimeout: 60000,
    include: ["tests/conformance/**/*.conformance.ts"],
    testTimeout: 20000,
  },
});
