/**
 * Makes the LCOV reports honest before SonarCloud reads them. Two passes.
 *
 * PASS 1 — drop non-executable lines
 * ----------------------------------
 * `c8` derives its line set from V8 coverage ranges over the COMPILED output,
 * then maps it back onto the TypeScript source. The result is a `DA:` entry for
 * *every* line of a loaded file — blank lines and comments included. Inside a
 * region the tests never execute, all of those count as uncovered, so a
 * comment-heavy file is reported far below its real coverage.
 *
 * That is not cosmetic: SonarCloud takes its "lines to cover" straight from
 * these entries, and the quality gate requires `new_coverage >= 80%`. It made
 * `lib/core/storage/clientAdapter.ts` — every handler and method of which is
 * exercised — report 40.3%, and it would have blocked every conversion whose
 * tests live in vitest, since the vitest reporter only ever ADDS covered lines
 * and cannot shrink c8's denominator.
 *
 * WHAT
 * ----
 * For each source file in the report, this drops the `DA:` entries whose line
 * is blank or comment-only, and recomputes `LF`/`LH` accordingly. Both
 * directions are more truthful: an uncoverable line stops counting against the
 * file, and one that had been credited as "hit" stops counting for it.
 *
 * Deliberately conservative: only blank and comment-only lines go. Closing
 * braces, `});` and the like stay, even though they are not statements either —
 * dropping them would need real parsing, and being wrong there would overstate
 * coverage, which is the one error worth avoiding here.
 *
 * PASS 2 — one owner per file
 * ---------------------------
 * Pass 1 is not enough. After it, c8 still reports 662 measurable lines for
 * `clientAdapter.ts` where vitest's v8 provider sees 213: the remainder are
 * closing braces, `});`, and the continuation lines of multi-line calls.
 * Trimming those needs real parsing, and being wrong there would OVERSTATE
 * coverage — the one error worth avoiding here.
 *
 * So the two providers disagree on what is executable, and merging their line
 * sets is only valid when they agree. They do not. A file therefore has to be
 * measured by ONE of them: the runner that owns its spec, per the `tests/`
 * mirror convention (`tests/util/bytes.test.ts` owns `lib/util/bytes.ts`).
 *
 * Conservative by construction: the mocha record is dropped only when vitest's
 * ratio for that file is at least as high, so this can never lower a file's
 * measured coverage. Any file where mocha still wins is printed and left
 * alone — that is a signal worth looking at, not a case to paper over.
 *
 * Usage: npx tsx .ci/scripts/prepare-coverage.ts <mocha lcov> <vitest lcov>
 * Rewrites both in place and prints what it did.
 *
 * See docs/adr-001/steps/07-sprint-5-core-i.md.
 */

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Line numbers (1-based) that cannot carry executable code: blank, or entirely
 * inside a comment.
 */
function nonExecutableLines(source: string): Set<number> {
  const dropped = new Set<number>();
  const lines = source.split("\n");
  let inBlockComment = false;

  for (const [index, raw] of lines.entries()) {
    const line = raw.trim();
    const lineNumber = index + 1;

    if (inBlockComment) {
      dropped.add(lineNumber);

      // A line that closes the block may still carry code after `*/`; only
      // treat it as dropped when nothing follows.
      const end = line.indexOf("*/");

      if (end !== -1) {
        inBlockComment = false;

        if (line.slice(end + 2).trim().length > 0) {
          dropped.delete(lineNumber);
        }
      }

      continue;
    }

    if (line.length === 0 || line.startsWith("//")) {
      dropped.add(lineNumber);
      continue;
    }

    if (line.startsWith("/*")) {
      const end = line.indexOf("*/");

      if (end === -1) {
        inBlockComment = true;
        dropped.add(lineNumber);
      } else if (line.slice(end + 2).trim().length === 0) {
        dropped.add(lineNumber);
      }
    }
  }

  return dropped;
}

interface Totals {
  found: number;
  hit: number;
}

function filterReport(lcov: string): {
  output: string;
  before: Totals;
  after: Totals;
} {
  const before: Totals = { found: 0, hit: 0 };
  const after: Totals = { found: 0, hit: 0 };
  const output: string[] = [];

  let dropped: Set<number> = new Set();
  let found = 0;
  let hit = 0;
  let pending: string[] = [];

  const flush = () => {
    for (const line of pending) {
      if (line.startsWith("LF:")) {
        output.push(`LF:${found}`);
      } else if (line.startsWith("LH:")) {
        output.push(`LH:${hit}`);
      } else {
        output.push(line);
      }
    }
    pending = [];
  };

  for (const line of lcov.split("\n")) {
    if (line.startsWith("SF:")) {
      flush();
      const path = line.slice(3).trim();

      dropped = existsSync(path)
        ? nonExecutableLines(readFileSync(path, "utf8"))
        : new Set();
      found = 0;
      hit = 0;
      pending.push(line);
      continue;
    }

    if (line.startsWith("DA:")) {
      const [rawLine, rawHits] = line.slice(3).split(",");
      const lineNumber = Number.parseInt(rawLine, 10);
      const hits = Number.parseInt(rawHits, 10);

      before.found += 1;
      before.hit += hits > 0 ? 1 : 0;

      if (dropped.has(lineNumber)) {
        continue;
      }

      found += 1;
      hit += hits > 0 ? 1 : 0;
      after.found += 1;
      after.hit += hits > 0 ? 1 : 0;
      pending.push(line);
      continue;
    }

    if (line === "end_of_record") {
      pending.push(line);
      flush();
      continue;
    }

    pending.push(line);
  }

  flush();

  return { output: output.join("\n"), before, after };
}

const pct = ({ found, hit }: Totals) =>
  found === 0 ? "n/a" : `${((100 * hit) / found).toFixed(1)}%`;

/** Per-file line coverage, keyed by source path. */
function perFile(lcov: string): Map<string, Totals> {
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

/** Removes whole `SF:` records from a report. */
function dropRecords(lcov: string, paths: Set<string>): string {
  const output: string[] = [];
  let skipping = false;

  for (const line of lcov.split("\n")) {
    if (line.startsWith("SF:")) {
      skipping = paths.has(line.slice(3).trim());
    }

    if (!skipping) {
      output.push(line);
    }

    if (line === "end_of_record") {
      skipping = false;
    }
  }

  return output.join("\n");
}

/** The source file a vitest spec measures, per the `tests/` mirror convention. */
function specTarget(spec: string): string | null {
  const relative = spec.slice("tests/".length, -".test.ts".length);

  for (const candidate of [`lib/${relative}.ts`, `lib/${relative}/index.ts`]) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

function vitestOwnedFiles(): Set<string> {
  const owned = new Set<string>();
  const walk = (dir: string) => {
    if (!existsSync(dir)) {
      return;
    }

    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);

      if (entry.isDirectory()) {
        walk(path);
      } else if (entry.name.endsWith(".test.ts")) {
        const target = specTarget(path);

        if (target) {
          owned.add(target);
        }
      }
    }
  };

  walk("tests");

  return owned;
}

const [mochaFile, vitestFile] = process.argv.slice(2);

if (!mochaFile || !vitestFile) {
  console.error(
    "usage: npx tsx .ci/scripts/prepare-coverage.ts <mocha lcov> <vitest lcov>",
  );
  process.exit(2);
}

// --- pass 1: non-executable lines
for (const file of [mochaFile, vitestFile]) {
  if (!existsSync(file)) {
    console.log(`\u00b7 ${file}: not found, skipped`);
    continue;
  }

  const { output, before, after } = filterReport(readFileSync(file, "utf8"));

  writeFileSync(file, output);
  console.log(
    `\u2714 ${file}: ${before.found} \u2192 ${after.found} lines to cover ` +
      `(dropped ${before.found - after.found} blank/comment), ` +
      `coverage ${pct(before)} \u2192 ${pct(after)}`,
  );
}

// --- pass 2: one owner per file
if (existsSync(mochaFile) && existsSync(vitestFile)) {
  const mochaTotals = perFile(readFileSync(mochaFile, "utf8"));
  const vitestTotals = perFile(readFileSync(vitestFile, "utf8"));
  const handOver = new Set<string>();

  for (const target of vitestOwnedFiles()) {
    const vitest = vitestTotals.get(target);
    const mocha = mochaTotals.get(target);

    if (!vitest || !mocha) {
      continue;
    }

    if (vitest.hit / vitest.found >= mocha.hit / mocha.found) {
      handOver.add(target);
      console.log(
        `\u21a6 ${target}: measured by vitest (${pct(vitest)} of ${vitest.found}), ` +
          `dropping the mocha record (${pct(mocha)} of ${mocha.found})`,
      );
    } else {
      console.log(
        `\u26a0 ${target}: has a vitest spec, but mocha measures it BETTER ` +
          `(${pct(mocha)} vs ${pct(vitest)}) \u2014 left to mocha, worth a look`,
      );
    }
  }

  if (handOver.size > 0) {
    writeFileSync(
      mochaFile,
      dropRecords(readFileSync(mochaFile, "utf8"), handOver),
    );
  }

  console.log(
    `\u2714 ${handOver.size} file(s) handed over to the vitest report`,
  );
}
