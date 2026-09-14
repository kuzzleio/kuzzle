import { describe, expect, it } from "vitest";

import {
  conversionFailures,
  convertedFiles,
  coverageExemptions,
  mergeTotals,
} from "../../.ci/scripts/prepare-coverage";

/**
 * Pass 3 of the coverage preparation — the per-file conversion gate (TD-42,
 * #2729). The pass exists because an aggregate threshold prices a block and
 * says nothing about its worst member, so the one property worth pinning here
 * is that the gate SEES the file a reviewer would have asked about: the
 * conversion nothing executes, in both of the shapes git records it in.
 */
describe("convertedFiles", () => {
  it("takes a .js -> .ts rename", () => {
    expect(
      convertedFiles("R096\tlib/util/bytes.js\tlib/util/bytes.ts"),
    ).toEqual(["lib/util/bytes.ts"]);
  });

  it("takes the delete + add git records a heavy rewrite as", () => {
    expect(
      convertedFiles(
        ["D\tlib/util/bytes.js", "A\tlib/util/bytes.ts"].join("\n"),
      ),
    ).toEqual(["lib/util/bytes.ts"]);
  });

  it("does not take a .ts file that is simply new", () => {
    expect(convertedFiles("A\tlib/util/brandNew.ts")).toEqual([]);
  });

  it("does not take a rename that was already TypeScript", () => {
    expect(convertedFiles("R100\tlib/util/old.ts\tlib/util/new.ts")).toEqual(
      [],
    );
  });

  it("ignores declarations and anything outside lib/", () => {
    expect(
      convertedFiles(
        [
          "R096\tlib/util/types.js\tlib/util/types.d.ts",
          "R096\tbin/wait-kuzzle.js\tbin/wait-kuzzle.ts",
          "R096\ttests/util/bytes.js\ttests/util/bytes.ts",
        ].join("\n"),
      ),
    ).toEqual([]);
  });

  it("reports each conversion once, sorted", () => {
    expect(
      convertedFiles(
        [
          "R096\tlib/util/b.js\tlib/util/b.ts",
          "D\tlib/util/a.js",
          "A\tlib/util/a.ts",
        ].join("\n"),
      ),
    ).toEqual(["lib/util/a.ts", "lib/util/b.ts"]);
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

describe("mergeTotals", () => {
  it("adds up a file measured by both runners", () => {
    const merged = mergeTotals(
      new Map([["lib/a.ts", { found: 10, hit: 4 }]]),
      new Map([
        ["lib/a.ts", { found: 6, hit: 6 }],
        ["lib/b.ts", { found: 2, hit: 0 }],
      ]),
    );

    expect(merged.get("lib/a.ts")).toEqual({ found: 16, hit: 10 });
    expect(merged.get("lib/b.ts")).toEqual({ found: 2, hit: 0 });
  });
});

describe("conversionFailures", () => {
  const noExemptions = new Map<string, string>();
  const silent = () => {};

  it("fails a conversion no report mentions", () => {
    const failures = conversionFailures(
      ["lib/core/network/protocols/protocol.ts"],
      new Map(),
      noExemptions,
      silent,
    );

    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain("absent from both coverage reports");
  });

  it("fails a conversion that is loaded but never executed", () => {
    const failures = conversionFailures(
      ["lib/a.ts"],
      new Map([["lib/a.ts", { found: 40, hit: 0 }]]),
      noExemptions,
      silent,
    );

    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain("none of them hit");
  });

  it("passes a conversion with a single hit line, and says so", () => {
    const log: string[] = [];
    const failures = conversionFailures(
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
    const failures = conversionFailures(
      ["lib/types/only.ts"],
      new Map(),
      new Map([["lib/types/only.ts", "type-only, no executable line"]]),
      (line) => log.push(line),
    );

    expect(failures).toEqual([]);
    expect(log[0]).toContain("type-only, no executable line");
  });

  it("reports every failing file, not just the first", () => {
    const failures = conversionFailures(
      ["lib/a.ts", "lib/b.ts", "lib/c.ts"],
      new Map([["lib/b.ts", { found: 10, hit: 5 }]]),
      noExemptions,
      silent,
    );

    expect(failures).toHaveLength(2);
  });
});
