import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  checkFiles,
  globToRegExp,
  isFrozenHub,
  loadBudgets,
  stepStatus,
} from "../../.ci/scripts/check-doc-budgets";

/**
 * The documentation budgets. The property worth pinning is that each file
 * takes the role a reader would expect: a living file is bounded, an open step
 * is bounded until it closes, and nothing in a closed ADR is (it is archive,
 * write-once, and nobody resumes it).
 */
describe("globToRegExp", () => {
  it("lets ** cross directories and * stop at a slash", () => {
    expect(
      globToRegExp("docs/adr-*/steps/**/*.md").test(
        "docs/adr-003/steps/01-x.md",
      ),
    ).toBe(true);
    expect(
      globToRegExp("docs/adr-*/steps/**/*.md").test(
        "docs/adr-003/steps/01-x/part.md",
      ),
    ).toBe(true);
    expect(
      globToRegExp(".claude/skills/*/SKILL.md").test(
        ".claude/skills/a/b/SKILL.md",
      ),
    ).toBe(false);
  });

  it("is anchored on the whole path", () => {
    expect(globToRegExp("README.md").test("lib/README.md")).toBe(false);
  });
});

describe("stepStatus", () => {
  it.each(["✅ Done", "🧊 Frozen/Archive", "🚫 Abandoned"])(
    "reads %s as closed",
    (s) => {
      expect(stepStatus(`# Step\n\n**Status:** ${s} · **PR:** #1\n`).open).toBe(
        false,
      );
    },
  );

  it.each(["⬜ To do", "🟦 In progress"])("reads %s as open", (s) => {
    expect(stepStatus(`# Step\n\n**Status:** ${s}\n`).open).toBe(true);
  });

  it("bounds a step file that has no status line", () => {
    expect(stepStatus("# Step\n").open).toBe(true);
  });
});

describe("isFrozenHub", () => {
  it("takes Closed and Abandoned, bold or not", () => {
    expect(
      isFrozenHub("**Status:** **Closed — implemented (2026-09-24).**"),
    ).toBe(true);
    expect(isFrozenHub("**Status:** Abandoned")).toBe(true);
  });

  it("leaves an accepted ADR living", () => {
    expect(isFrozenHub("**Status:** Accepted (2026-09-29)")).toBe(false);
  });
});

describe("checkFiles", () => {
  let root: string;

  const write = (rel: string, content: string) => {
    mkdirSync(dirname(join(root, rel)), { recursive: true });
    writeFileSync(join(root, rel), content);
  };

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "doc-budgets-"));
    write(
      "docs/doc-budgets.json",
      JSON.stringify({
        default: { advice: "cut", maxKB: 1, role: "living" },
        rules: [
          { pattern: "CHANGELOG.md", role: "exempt" },
          { maxKB: 1, pattern: "docs/adr-*/steps/**/*.md", role: "step" },
          { maxKB: 1, pattern: "docs/adr-*/ADR-*.md", role: "living" },
        ],
      }),
    );
  });

  afterEach(() => {
    rmSync(root, { force: true, recursive: true });
  });

  const big = "x".repeat(1500);

  it("fails a living file over its budget, with the advice", () => {
    write("README.md", big);

    const { errors } = checkFiles(root, ["README.md"], loadBudgets(root));

    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("To do: cut");
  });

  it("warns, without failing, at 90% of a budget", () => {
    write("README.md", "x".repeat(950));

    const { errors, warnings } = checkFiles(
      root,
      ["README.md"],
      loadBudgets(root),
    );

    expect(errors).toHaveLength(0);
    expect(warnings).toHaveLength(1);
  });

  it("never bounds an exempt file", () => {
    write("CHANGELOG.md", big);

    expect(
      checkFiles(root, ["CHANGELOG.md"], loadBudgets(root)).errors,
    ).toHaveLength(0);
  });

  it("bounds an open step and lets a closed one grow", () => {
    write("docs/adr-009/ADR-0009-x.md", "**Status:** Accepted\n");
    write(
      "docs/adr-009/steps/01-open.md",
      `**Status:** 🟦 In progress\n${big}`,
    );
    write("docs/adr-009/steps/02-done.md", `**Status:** ✅ Done\n${big}`);

    const { errors } = checkFiles(
      root,
      ["docs/adr-009/steps/01-open.md", "docs/adr-009/steps/02-done.md"],
      loadBudgets(root),
    );

    expect(errors.map((e) => e.file)).toEqual([
      "docs/adr-009/steps/01-open.md",
    ]);
  });

  it("treats every file of a closed ADR as archive, its hub and open steps included", () => {
    write(
      "docs/adr-009/ADR-0009-x.md",
      `**Status:** **Closed — implemented.**\n${big}`,
    );
    write(
      "docs/adr-009/steps/01-open.md",
      `**Status:** 🟦 In progress\n${big}`,
    );

    const { errors, lines } = checkFiles(
      root,
      ["docs/adr-009/ADR-0009-x.md", "docs/adr-009/steps/01-open.md"],
      loadBudgets(root),
    );

    expect(errors).toHaveLength(0);
    expect(lines.map((l) => l.rule.role)).toEqual(["archive", "archive"]);
  });
});
