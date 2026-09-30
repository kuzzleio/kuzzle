import { describe, expect, it } from "vitest";

import {
  coverageExemptions,
  coverageFailures,
  newLibFiles,
  perFile,
} from "../../.ci/scripts/coverage-gate";

/**
 * The per-file coverage gate (TD-42, #2729). It exists because an aggregate
 * threshold prices a block and says nothing about its worst member, so the one
 * property worth pinning here is that the gate SEES the file a reviewer would
 * have asked about: the new `lib/` file nothing executes, in every shape git
 * records it in.
 *
 * `newLibFiles` was `convertedFiles` until step 13's L7b, and it matched only
 * `.js` -> `.ts` renames. There is no `.js` left under `lib/` and the `js`
 * ratchet forbids adding one, so that predicate could never fire again — the
 * rule was never about conversions, and the tests below say what it is about.
 */
describe("newLibFiles", () => {
  it("takes a .js -> .ts rename", () => {
    expect(newLibFiles("R096\tlib/util/bytes.js\tlib/util/bytes.ts")).toEqual([
      "lib/util/bytes.ts",
    ]);
  });

  it("takes the delete + add git records a heavy rewrite as", () => {
    expect(
      newLibFiles(["D\tlib/util/bytes.js", "A\tlib/util/bytes.ts"].join("\n")),
    ).toEqual(["lib/util/bytes.ts"]);
  });

  it("takes a .ts file that is simply new — the point of the change", () => {
    expect(newLibFiles("A\tlib/util/brandNew.ts")).toEqual([
      "lib/util/brandNew.ts",
    ]);
  });

  it("does not take a rename that was already TypeScript", () => {
    expect(newLibFiles("R100\tlib/util/old.ts\tlib/util/new.ts")).toEqual([]);
  });

  it("does not take a modification", () => {
    expect(newLibFiles("M\tlib/util/bytes.ts")).toEqual([]);
  });

  it("ignores declarations and anything outside lib/", () => {
    expect(
      newLibFiles(
        [
          "A\tlib/util/types.d.ts",
          "R096\tlib/util/types.js\tlib/util/types.d.ts",
          "A\tbin/wait-kuzzle.ts",
          "A\ttests/util/bytes.test.ts",
        ].join("\n"),
      ),
    ).toEqual([]);
  });

  it("reports each file once, sorted", () => {
    expect(
      newLibFiles(
        [
          "R096\tlib/util/b.js\tlib/util/b.ts",
          "D\tlib/util/a.js",
          "A\tlib/util/a.ts",
          "A\tlib/util/c.ts",
        ].join("\n"),
      ),
    ).toEqual(["lib/util/a.ts", "lib/util/b.ts", "lib/util/c.ts"]);
  });
});

describe("perFile", () => {
  it("counts a DA: entry as covered when it was hit at least once", () => {
    const totals = perFile(
      [
        "SF:lib/a.ts",
        "DA:1,3",
        "DA:2,0",
        "DA:3,1",
        "end_of_record",
        "SF:lib/b.ts",
        "DA:1,0",
        "end_of_record",
      ].join("\n"),
    );

    expect(totals.get("lib/a.ts")).toEqual({ found: 3, hit: 2 });
    expect(totals.get("lib/b.ts")).toEqual({ found: 1, hit: 0 });
  });
});

describe("coverageExemptions", () => {
  it("reads a path and keeps the reason beside it", () => {
    const exempt = coverageExemptions(
      [
        "# a comment",
        "",
        "lib/types/only.ts   nothing but interfaces, no executable line",
      ].join("\n"),
    );

    expect([...exempt.keys()]).toEqual(["lib/types/only.ts"]);
    expect(exempt.get("lib/types/only.ts")).toBe(
      "nothing but interfaces, no executable line",
    );
  });
});

describe("coverageFailures", () => {
  const noExemptions = new Map<string, string>();
  const silent = () => {};

  it("fails a file the report does not mention", () => {
    const failures = coverageFailures(
      ["lib/core/network/protocols/protocol.ts"],
      new Map(),
      noExemptions,
      silent,
    );

    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain("absent from the coverage report");
  });

  it("fails a file that is loaded but never executed", () => {
    const failures = coverageFailures(
      ["lib/a.ts"],
      new Map([["lib/a.ts", { found: 40, hit: 0 }]]),
      noExemptions,
      silent,
    );

    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain("none of them hit");
  });

  it("passes a file with a single hit line, and says so", () => {
    const log: string[] = [];
    const failures = coverageFailures(
      ["lib/a.ts"],
      new Map([["lib/a.ts", { found: 40, hit: 1 }]]),
      noExemptions,
      (line) => log.push(line),
    );

    expect(failures).toEqual([]);
    expect(log[0]).toContain("lib/a.ts");
  });

  it("lets a recorded exemption through and prints its reason", () => {
    const log: string[] = [];
    const failures = coverageFailures(
      ["lib/types/only.ts"],
      new Map(),
      new Map([["lib/types/only.ts", "type-only, no executable line"]]),
      (line) => log.push(line),
    );

    expect(failures).toEqual([]);
    expect(log[0]).toContain("type-only, no executable line");
  });

  it("reports every failing file, not just the first", () => {
    const failures = coverageFailures(
      ["lib/a.ts", "lib/b.ts", "lib/c.ts"],
      new Map([["lib/b.ts", { found: 10, hit: 5 }]]),
      noExemptions,
      silent,
    );

    expect(failures).toHaveLength(2);
  });
});
