import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Specs live under `tests/` (the vitest tree; `test/` is the frozen Mocha
    // suite — see ADR-0001 › Tests). This used to be expressed as
    // `root: "tests"`, which silently broke coverage twice over: every
    // coverage path was then resolved against `tests/` instead of the repo
    // root, so `reportsDirectory` wrote to `tests/coverage/` where
    // `sonar.javascript.lcov.reportPaths` never looked, and the instrumented
    // scope was limited to `tests/` — so `lib/` was never measured and the
    // report came out empty. Selecting the specs with `include` keeps every
    // path repo-root-relative, like the rest of the tooling.
    include: ["tests/**/*.{test,spec}.ts"],
    coverage: {
      provider: "v8",
      reporter: ["lcov"],
      // One report directory per unit runner: SonarCloud is handed both
      // (ADR-0001 step 06, type-debt register TD-24).
      reportsDirectory: "coverage/vitest",
      // No explicit `include`: the v8 provider then reports only the files the
      // specs actually loaded. That is what we want when two lcov reports are
      // merged — listing all of `lib/` here would emit ~180 zero-hit records
      // that add nothing over the Mocha report.
    },
    environment: "node",
    globals: true,
    hookTimeout: 20000,
    testTimeout: 20000,
  },
});
