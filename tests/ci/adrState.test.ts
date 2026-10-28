import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  type AdrState,
  digest,
  hubStatus,
  isOpenStep,
  type State,
  validateState,
} from "../../.ci/scripts/adr-state";

/**
 * `docs/adr-state.json` holds the current state, never the history. What is
 * pinned here is what kept the same file from regrowing on paas-console: the
 * length limits, the ban on ✅ entries, and the state never contradicting the
 * hub or the step it points to.
 */
describe("status lines", () => {
  it("reads ⬜ and 🟦 as an open step, anything else as closed", () => {
    expect(isOpenStep("**Status:** 🟦 In progress")).toBe(true);
    expect(isOpenStep("**Status:** ⬜ To do")).toBe(true);
    expect(isOpenStep("**Status:** ✅ Done")).toBe(false);
    expect(isOpenStep("# no status")).toBe(false);
  });

  it("reads a hub's Closed / Abandoned, bold or not", () => {
    expect(hubStatus("**Status:** **Closed — implemented.**")).toBe("closed");
    expect(hubStatus("**Status:** Abandoned")).toBe("abandoned");
    expect(hubStatus("**Status:** Accepted (2026-09-29)")).toBe("other");
  });
});

describe("validateState", () => {
  let root: string;

  const write = (rel: string, content: string) => {
    mkdirSync(dirname(join(root, rel)), { recursive: true });
    writeFileSync(join(root, rel), content);
  };

  const adr = (over: Partial<AdrState> = {}): AdrState => ({
    blockers: [],
    hub: "docs/adr-009/ADR-0009-x.md",
    id: "0009",
    nextAction: "Open step 01.",
    openPoints: [],
    openStep: null,
    status: "accepted",
    statusLabel: "🟡 Accepted",
    title: "X",
    ...over,
  });

  const state = (...adrs: AdrState[]): State => ({
    adrs,
    latestVersion: "2.59.0",
    snapshot: "2026-10-06",
  });

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "adr-state-"));
    write("docs/adr-009/ADR-0009-x.md", "# ADR-0009\n\n**Status:** Accepted\n");
    write("docs/adr-009/steps/01-open.md", "**Status:** 🟦 In progress\n");
    write("docs/adr-009/steps/00-done.md", "**Status:** ✅ Done\n");
  });

  afterEach(() => {
    rmSync(root, { force: true, recursive: true });
  });

  it("accepts a well-formed state", () => {
    expect(validateState(state(adr()), root)).toEqual([]);
  });

  it("rejects a next action that has become a report", () => {
    const problems = validateState(
      state(adr({ nextAction: "x".repeat(301) })),
      root,
    );

    expect(problems).toEqual([
      expect.stringContaining("nextAction: 301 chars > 300"),
    ]);
  });

  it("rejects a ✅ entry: what is done leaves the file", () => {
    const problems = validateState(
      state(adr({ openPoints: ["✅ shipped in #1"] })),
      root,
    );

    expect(problems).toEqual([
      expect.stringContaining("what is done leaves this file"),
    ]);
  });

  it("rejects more open points than fit", () => {
    const problems = validateState(
      state(adr({ openPoints: Array(7).fill("a") })),
      root,
    );

    expect(problems).toEqual([expect.stringContaining("7 entries > 6")]);
  });

  it("rejects an open step whose own status line is closed", () => {
    const problems = validateState(
      state(
        adr({ openStep: "docs/adr-009/steps/00-done.md", status: "active" }),
      ),
      root,
    );

    expect(problems).toEqual([expect.stringContaining("is not open")]);
  });

  it("requires an active ADR to name its open step", () => {
    expect(validateState(state(adr({ status: "active" })), root)).toEqual([
      expect.stringContaining("names its open step"),
    ]);
    expect(
      validateState(
        state(
          adr({ openStep: "docs/adr-009/steps/01-open.md", status: "active" }),
        ),
        root,
      ),
    ).toEqual([]);
  });

  it("rejects a status that contradicts the hub", () => {
    expect(validateState(state(adr({ status: "closed" })), root)).toEqual([
      expect.stringContaining("contradicts the hub"),
    ]);
  });

  it("digests the live ADRs and only names the closed ones", () => {
    write("docs/adr-008/ADR-0008-y.md", "**Status:** Closed\n");
    const text = digest(
      state(
        adr(),
        adr({
          hub: "docs/adr-008/ADR-0008-y.md",
          id: "0008",
          nextAction: null,
          status: "closed",
          statusLabel: "⚪ Closed",
        }),
      ),
      root,
    );

    expect(text).toContain("**ADR-0009**");
    expect(text).toContain("Next action: Open step 01.");
    expect(text).toContain("Closed: ADR-0008 (Closed).");
  });
});
