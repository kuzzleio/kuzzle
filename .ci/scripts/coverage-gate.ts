/**
 * Holds the per-file rule the aggregate coverage gate cannot: **a file that
 * arrives in `lib/` must be executed by a spec.**
 *
 * The conversion standard has always said "a file with no unit spec ships one",
 * and the gate that was supposed to hold it is SonarCloud's 80% `new_coverage`
 * — an aggregate over the whole PR. An aggregate prices the block and says
 * nothing about its worst member: #2723 passed at 88.3% with three files
 * carrying no spec at all, two of which had just received bug fixes
 * (TD-42, #2729).
 *
 * So, per file: every `lib/**.ts` this PR adds must appear in the coverage
 * report with at least one line hit. A well-covered sibling cannot pay for a
 * file nothing executes. Deliberate exceptions — a file whose output is
 * genuinely type-only, with no executable line to hit — go in
 * `.migration/coverage-exempt.txt`, one path per line with the reason beside
 * it, so that "nothing runs this" stays a decision someone wrote down rather
 * than a number nobody read.
 *
 * The gate needs the PR's base commit, which it takes from `COVERAGE_BASE_SHA`;
 * with the variable unset it says so and does nothing, because outside a PR
 * there is no set of "files this change added".
 *
 * ## What this script used to be
 *
 * It was `prepare-coverage.ts`, and it had two more passes, both of which
 * existed only because two unit runners fed the scanner. ADR-0001 step 13
 * closed that, and L7b removed them:
 *
 * **Pass 1 — dropping non-executable lines** corrected a `c8` artefact: c8
 * derived its line set from V8 ranges over the COMPILED output and emitted a
 * `DA:` entry for *every* line of a loaded file, blank lines and comments
 * included, which reported `clientAdapter.ts` at 40.3% with every handler
 * under test. **vitest's v8 provider does not do this**, and that is measured,
 * not assumed: over the whole suite's report — 280 files, 13 947 `DA:`
 * entries — **zero** land on a blank or comment-only line.
 *
 * **Pass 2 — one owner per file** arbitrated between the two reports, because
 * c8 and vitest disagreed on what counts as an executable line and merging
 * their line sets understated coverage badly. With one report there is nothing
 * to arbitrate. It took `specTarget()` and the `tests/` mirror convention with
 * it — and the worry filed in step 13's L3d, that *an unmirrored spec is
 * silently unowned*, goes with them: ownership was only ever a two-runner
 * problem. Every file vitest executes is in vitest's report, mirror or not.
 *
 * See docs/adr-001/steps/07-sprint-5-core-i.md for the pairing this replaced,
 * and step 13's _What L7b found_ for why it shrank.
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

interface Totals {
  found: number;
  hit: number;
}

const pct = ({ found, hit }: Totals) =>
  found === 0 ? "n/a" : `${((100 * hit) / found).toFixed(1)}%`;

/** Per-file line coverage, keyed by source path. */
export function perFile(lcov: string): Map<string, Totals> {
  const totals = new Map<string, Totals>();
  let current: string | null = null;

  for (const line of lcov.split("\n")) {
    if (line.startsWith("SF:")) {
      current = line.slice(3).trim();
      totals.set(current, { found: 0, hit: 0 });
    } else if (line.startsWith("DA:") && current) {
      const entry = totals.get(current);
      const hits = Number.parseInt(line.slice(3).split(",")[1], 10);

      entry.found += 1;
      entry.hit += hits > 0 ? 1 : 0;
    }
  }

  return totals;
}

const EXEMPT_FILE = ".migration/coverage-exempt.txt";

/**
 * The `lib/` TypeScript files a `git diff --name-status` output shows as new.
 *
 * "New" is deliberately wider than the JS → TS conversions this gate was
 * written for, and it is wider since L7b: there are no `.js` files left under
 * `lib/` and the `js` ratchet forbids adding one, so a predicate that only
 * matched conversions could never fire again. The rule it enforces was never
 * about conversions — it is that code arriving in `lib/` is executed by a spec
 * — so the predicate now says that.
 *
 * Three shapes reach git, and all three are the same event here:
 *   - `A  lib/x.ts` — a new file;
 *   - `R  lib/x.js → lib/x.ts` — a conversion git matched as a rename;
 *   - `D lib/x.js` + `A lib/x.ts` — a conversion rewritten past `--find-renames`.
 *
 * A pure `.ts` → `.ts` rename is NOT in scope: the code existed before, and its
 * spec most likely moved with it.
 */
export function newLibFiles(diff: string): string[] {
  const added = new Set<string>();
  const renamedFromTs = new Set<string>();

  const inScope = (path: string) =>
    path.startsWith("lib/") && path.endsWith(".ts") && !path.endsWith(".d.ts");

  for (const record of diff.split("\n")) {
    const [status, first, second] = record.split("\t");

    if (!status) {
      continue;
    }

    if (status.startsWith("R") && first && second) {
      if (inScope(second)) {
        (first.endsWith(".ts") ? renamedFromTs : added).add(second);
      }
    } else if (status === "A" && first && inScope(first)) {
      added.add(first);
    }
  }

  for (const path of renamedFromTs) {
    added.delete(path);
  }

  return [...added].sort();
}

/** `git diff --name-status` between the PR's base commit and the working tree. */
function diffAgainstBase(baseSha: string): string {
  return execFileSync(
    "git",
    [
      "diff",
      "--name-status",
      "--find-renames",
      "--diff-filter=ADR",
      baseSha,
      "HEAD",
    ],
    { encoding: "utf8" },
  );
}

/**
 * Paths this gate deliberately does not hold, from `.migration/coverage-exempt.txt`.
 * Format: one path per line, `#` comments and blank lines ignored, anything
 * after the path on the line is the reason and is printed back.
 */
export function coverageExemptions(contents: string): Map<string, string> {
  const exempt = new Map<string, string>();

  for (const raw of contents.split("\n")) {
    const line = raw.trim();

    if (line.length === 0 || line.startsWith("#")) {
      continue;
    }

    const [path, ...reason] = line.split(/\s+/);

    exempt.set(path, reason.join(" "));
  }

  return exempt;
}

/**
 * What the gate has to say about each new file. Returns the failures; the lines
 * it is happy with are printed by the caller.
 */
export function coverageFailures(
  files: string[],
  coverage: Map<string, Totals>,
  exempt: Map<string, string>,
  log: (line: string) => void,
): string[] {
  const failures: string[] = [];

  for (const file of files) {
    if (exempt.has(file)) {
      log(`· ${file}: exempt — ${exempt.get(file) || "no reason recorded"}`);
      continue;
    }

    const totals = coverage.get(file);

    if (!totals || totals.found === 0) {
      failures.push(
        `${file}: new in this PR and absent from the coverage report — no spec loads it`,
      );
      continue;
    }

    if (totals.hit === 0) {
      failures.push(
        `${file}: new in this PR, ${totals.found} lines to cover, none of them hit`,
      );
      continue;
    }

    log(`✔ ${file}: new, ${pct(totals)} of ${totals.found} lines`);
  }

  return failures;
}

function main([lcovFile]: string[]): number {
  if (!lcovFile) {
    console.error("usage: npx tsx .ci/scripts/coverage-gate.ts <vitest lcov>");

    return 2;
  }

  const baseSha = process.env.COVERAGE_BASE_SHA;

  if (!baseSha) {
    console.log(
      "· COVERAGE_BASE_SHA unset — per-file coverage gate skipped " +
        '(there is no set of "files this change added" outside a PR)',
    );

    return 0;
  }

  const files = newLibFiles(diffAgainstBase(baseSha));

  if (files.length === 0) {
    console.log("✔ no new lib/ file in this PR, nothing to gate");

    return 0;
  }

  if (!existsSync(lcovFile)) {
    console.error(
      `✖ ${lcovFile}: no coverage report, and this PR adds ` +
        `${files.length} file(s) to lib/ that the gate has to check`,
    );

    return 1;
  }

  const coverage = perFile(readFileSync(lcovFile, "utf8"));

  const exempt = existsSync(EXEMPT_FILE)
    ? coverageExemptions(readFileSync(EXEMPT_FILE, "utf8"))
    : new Map<string, string>();

  const failures = coverageFailures(files, coverage, exempt, (line) =>
    console.log(line),
  );

  if (failures.length > 0) {
    console.error(
      `\n✖ ${failures.length} of ${files.length} new lib/ file(s) are not executed by any spec:`,
    );

    for (const failure of failures) {
      console.error(`  • ${failure}`);
    }

    console.error(
      "\nADR-0001: a file with no spec ships one. The aggregate coverage gate " +
        "cannot see this (TD-42, #2729).\nWrite the spec, or record the file in " +
        `${EXEMPT_FILE} with the reason nothing can execute it.`,
    );

    return 1;
  }

  console.log(`✔ all ${files.length} new lib/ file(s) are executed by a spec`);

  return 0;
}

// Only when run as a script: the pure helpers above are imported by
// tests/ci/coverageGate.test.ts, and importing must not run the gate.
if (process.argv[1]?.endsWith("coverage-gate.ts")) {
  process.exit(main(process.argv.slice(2)));
}
