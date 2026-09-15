/**
 * Re-derives an LCOV report from c8's raw V8 output, merging the per-script
 * coverages at the **istanbul** level instead of the **V8** level.
 *
 * WHY THIS EXISTS
 * ---------------
 * A module that is loaded more than once in a single process — which is what
 * `mock-require`'s `reRequire` does, and 43 of the Mocha specs use it — is
 * compiled by V8 more than once. The process then reports several
 * `ScriptCoverage` entries for the same URL, each holding the coverage of one
 * instance.
 *
 * c8 merges those with `mergeProcessCovs` from `@bcoe/v8-coverage`, which
 * operates on V8 *ranges*, before handing anything to `v8-to-istanbul`. That
 * merge loses coverage. Measured on `lib/core/validation/validation.js` with
 * three spec files (`init`, `validate`, `util`):
 *
 *   scriptId 1809 — 186 of 1180 statements
 *   scriptId 2141 — 878 of 1180 statements
 *   scriptId 2216 — 995 of 1180 statements
 *   c8's merged report ...... 508          ← fewer than its own largest input
 *   merged as istanbul ..... 1171 (99.2%)
 *
 * The three instances produce an **identical** 1180-entry `statementMap`, so
 * merging the converted `FileCoverage` objects is a plain per-key sum and is
 * exactly right. Merging the V8 ranges first is what throws the information
 * away — a function V8 never compiled in one instance is not "executed zero
 * times" there, it is "not reported", and the range merge cannot tell those
 * apart.
 *
 * The symptom this was found by is worth recording, because it is the cheap
 * way to spot the same bug elsewhere: **line coverage far below branch
 * coverage**. For a genuinely under-tested file the two move together and
 * branches sit at or below lines — you cannot exercise a branch on a line you
 * never ran. `validation.js` reported 36% of lines and 93% of branches.
 *
 * WHAT IT DOES
 * ------------
 * Reads c8's temp directory (raw `ScriptCoverage` JSON, one file per process),
 * converts each entry separately through `v8-to-istanbul` — which applies the
 * source map, so `dist/lib/**` lands back on `lib/**` — merges the results into
 * one coverage map, and writes `lcov.info` over c8's own.
 *
 * `.ci/scripts/prepare-coverage.ts` then runs on the result exactly as before;
 * this step only makes the numbers it normalises true ones.
 *
 * Usage: `npx tsx .ci/scripts/merge-coverage.ts <c8-report-dir>`
 *   e.g. `npx tsx .ci/scripts/merge-coverage.ts coverage/mocha`
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import { createCoverageMap } from "istanbul-lib-coverage";
import { createContext } from "istanbul-lib-report";
import { create as createReport } from "istanbul-reports";
import v8toIstanbul from "v8-to-istanbul";

const ROOT = resolve(__dirname, "..", "..");

type ScriptCoverage = {
  url: string;
  functions: unknown[];
};

type RawCoverage = {
  result?: ScriptCoverage[];
  "source-map-cache"?: Record<
    string,
    { data?: unknown; lineLengths?: number[] } | undefined
  >;
};

/**
 * c8's own rule, restated: measure what the project ships, not its tests, its
 * dependencies, or the tooling that runs them. The URLs here are the *compiled*
 * paths (Mocha runs `dist/`); the source map is what puts them back on `lib/`.
 */
function isMeasurable(path: string): boolean {
  if (!path.startsWith(ROOT)) {
    return false;
  }

  const rel = relative(ROOT, path);

  return (
    !rel.startsWith("node_modules") &&
    !rel.includes(`${"dist"}/test/`) &&
    !rel.includes(`${"dist"}/tests/`) &&
    /^(dist\/)?(lib|index)/u.test(rel)
  );
}

/**
 * The source map Node cached at runtime, when there is one. `v8-to-istanbul`
 * falls back to the `//# sourceMappingURL` comment on disk, which is what the
 * `dist/` build carries, so this only matters for runtime transpilers.
 */
function sourcesFor(
  raw: RawCoverage,
  url: string,
): { sourceMap: { sourcemap: unknown } } | undefined {
  const cached = raw["source-map-cache"]?.[url];

  return cached?.data ? { sourceMap: { sourcemap: cached.data } } : undefined;
}

async function main(): Promise<void> {
  const reportDir = process.argv[2];

  if (!reportDir) {
    console.error(
      "usage: npx tsx .ci/scripts/merge-coverage.ts <c8-report-dir>",
    );
    process.exit(2);
  }

  const tmpDir = join(resolve(ROOT, reportDir), "tmp");

  if (!existsSync(tmpDir)) {
    console.error(`❌ no raw V8 coverage in ${tmpDir} — did c8 run?`);
    process.exit(2);
  }

  const map = createCoverageMap({});
  let entries = 0;
  const instancesPerUrl = new Map<string, number>();

  for (const file of readdirSync(tmpDir)) {
    if (!file.endsWith(".json")) {
      continue;
    }

    const raw = JSON.parse(
      readFileSync(join(tmpDir, file), "utf8"),
    ) as RawCoverage;

    for (const script of raw.result ?? []) {
      const path = script.url.startsWith("file://")
        ? new URL(script.url).pathname
        : script.url;

      if (!isMeasurable(path) || !existsSync(path)) {
        continue;
      }

      instancesPerUrl.set(path, (instancesPerUrl.get(path) ?? 0) + 1);

      const converter = v8toIstanbul(path, 0, sourcesFor(raw, script.url));

      await converter.load();
      converter.applyCoverage(script.functions);
      map.merge(converter.toIstanbul());
      entries += 1;
    }
  }

  const context = createContext({
    coverageMap: map,
    dir: resolve(ROOT, reportDir),
  });

  createReport("lcovonly", { file: "lcov.info" }).execute(context);

  const reloaded = [...map.files()];
  const multi = [...instancesPerUrl.values()].filter((n) => n > 1).length;

  console.log(
    `✔ merged ${entries} V8 script coverage(s) over ${reloaded.length} file(s) → ${reportDir}/lcov.info`,
  );
  console.log(
    `  ${multi} file(s) were loaded more than once in a single process — the case c8's own merge loses`,
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
