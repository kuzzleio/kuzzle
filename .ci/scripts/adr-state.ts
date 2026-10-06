/* eslint-disable no-console -- a CLI: its report is its output */
/**
 * `docs/adr-state.json`: the CURRENT state of each ADR effort, as data.
 *
 * Answering "where are we?" used to mean reading a hub (ADR-0001's had reached
 * 116 KB) or a memory file that grew the same way. This file holds the answer
 * in a few hundred bytes per ADR, and a digest built from it is injected at
 * every Claude Code session start. It says the state, never the history: on
 * paas-console, where it comes from, the same file reached 54 KB once every
 * pass prepended a dated report to its fields, so the schema below is checked
 * in CI.
 *
 *   node .ci/scripts/adr-state.ts --check    # schema + consistency with the hubs + digest size
 *   node .ci/scripts/adr-state.ts --digest   # the SessionStart digest, on stdout
 *
 * Node builtins only, run through Node's type stripping: keep the syntax
 * erasable.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

export const STATE_FILE = "docs/adr-state.json";

export const LIMITS = {
  blocker: 200,
  blockers: 4,
  digest: 2500,
  fileBytes: 8000,
  nextAction: 300,
  openPoint: 200,
  openPoints: 6,
  statusLabel: 40,
  title: 80,
};

export const STATUSES = [
  "proposed",
  "accepted",
  "active",
  "closed",
  "abandoned",
] as const;

export type Status = (typeof STATUSES)[number];

export interface AdrState {
  id: string;
  hub: string;
  title: string;
  status: Status;
  statusLabel: string;
  openStep: string | null;
  nextAction: string | null;
  blockers: string[];
  openPoints: string[];
}

export interface State {
  snapshot: string;
  latestVersion: string;
  adrs: AdrState[];
}

function statusLine(text: string): string | undefined {
  return text.split("\n").find((l) => l.startsWith("**Status:**"));
}

/** Open = the step's `**Status:**` starts with ⬜ or 🟦 (kuzzle-adr skill). */
export function isOpenStep(text: string): boolean {
  const line = statusLine(text);

  return (
    line !== undefined &&
    /^(⬜|🟦)/u.test(line.slice("**Status:**".length).trim())
  );
}

/** Closed or Abandoned, as the hub's own `**Status:**` line says it. */
export function hubStatus(text: string): "closed" | "abandoned" | "other" {
  const line = statusLine(text) ?? "";
  const m = /^\*\*Status:\*\*[\s*_]*(Closed|Abandoned)\b/i.exec(line);

  if (!m) {
    return "other";
  }

  return m[1].toLowerCase() === "closed" ? "closed" : "abandoned";
}

/**
 * Every way `state` breaks the schema or contradicts the files it points to.
 * `root` is where the hub and step paths resolve.
 */
export function validateState(state: State, root: string): string[] {
  const problems: string[] = [];
  const say = (where: string, what: string) =>
    problems.push(`${where}: ${what}`);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(state.snapshot ?? "")) {
    say("snapshot", "expected YYYY-MM-DD");
  }

  if (!/^\d+\.\d+\.\d+/.test(state.latestVersion ?? "")) {
    say("latestVersion", "expected the npm `latest` version");
  }

  if (!Array.isArray(state.adrs)) {
    say("adrs", "expected an array");

    return problems;
  }

  for (const adr of state.adrs) {
    const at = `ADR-${adr.id}`;
    const line = (field: string, value: string, max: number) => {
      if (value.length > max) {
        say(`${at}.${field}`, `${value.length} chars > ${max}`);
      }

      if (value.includes("\n")) {
        say(`${at}.${field}`, "one line only");
      }

      if (/^\s*(✅|~~)/u.test(value)) {
        say(
          `${at}.${field}`,
          "what is done leaves this file: tell it in the hub register or the step, then remove it here",
        );
      }
    };

    if (!STATUSES.includes(adr.status)) {
      say(`${at}.status`, `expected one of ${STATUSES.join(" | ")}`);
    }

    line("title", adr.title ?? "", LIMITS.title);
    line("statusLabel", adr.statusLabel ?? "", LIMITS.statusLabel);

    if (adr.nextAction !== null) {
      line("nextAction", adr.nextAction, LIMITS.nextAction);
    }

    for (const [field, max, maxLen] of [
      ["blockers", LIMITS.blockers, LIMITS.blocker],
      ["openPoints", LIMITS.openPoints, LIMITS.openPoint],
    ] as const) {
      const list = adr[field];

      if (!Array.isArray(list)) {
        say(`${at}.${field}`, "expected an array");
        continue;
      }

      if (list.length > max) {
        say(
          `${at}.${field}`,
          `${list.length} entries > ${max}: what does not fit belongs in the hub's open points`,
        );
      }

      for (const [i, v] of list.entries()) {
        line(`${field}[${i}]`, v, maxLen);
      }
    }

    const hubPath = join(root, adr.hub ?? "");

    if (!adr.hub || !existsSync(hubPath)) {
      say(`${at}.hub`, `${adr.hub} does not exist`);
      continue;
    }

    const hub = hubStatus(readFileSync(hubPath, "utf8"));

    if (
      (adr.status === "closed" || adr.status === "abandoned") !==
      (hub !== "other")
    ) {
      say(
        `${at}.status`,
        `"${adr.status}" contradicts the hub's **Status:** line (${hub === "other" ? "not closed" : hub})`,
      );
    }

    if (adr.status === "active" && adr.openStep === null) {
      say(`${at}.openStep`, "an active ADR names its open step");
    }

    if (adr.openStep !== null) {
      const stepPath = join(root, adr.openStep);

      if (!existsSync(stepPath)) {
        say(`${at}.openStep`, `${adr.openStep} does not exist`);
      } else if (!isOpenStep(readFileSync(stepPath, "utf8"))) {
        say(
          `${at}.openStep`,
          `${adr.openStep}'s **Status:** line is not open (⬜/🟦): close it here too, or reopen it there`,
        );
      }
    }
  }

  return problems;
}

function git(root: string, args: string[]): string {
  try {
    return execFileSync("git", args, {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}

/** The SessionStart digest: what to resume, in a few hundred tokens. */
export function digest(state: State, root: string): string {
  const branch = git(root, ["rev-parse", "--abbrev-ref", "HEAD"]) || "?";
  const dirty = git(root, ["status", "--porcelain"]);
  const dirtyCount = dirty ? dirty.split("\n").length : 0;

  const out = [
    `## ADR state (${STATE_FILE}, snapshot ${state.snapshot})`,
    "",
    `Branch **${branch}** · npm \`latest\` **${state.latestVersion}**.`,
  ];

  if (dirtyCount > 0) {
    out.push(
      `⚠️ **${dirtyCount} uncommitted file(s)**: work in progress, possibly the user's own; respect it.`,
    );
  }

  const live = state.adrs.filter(
    (a) => a.status !== "closed" && a.status !== "abandoned",
  );

  if (live.length > 0) {
    out.push("");

    for (const a of live) {
      out.push(`- **ADR-${a.id}** — ${a.title} (${a.statusLabel})`);

      if (a.openStep) {
        out.push(`  - Open step: \`${a.openStep}\``);
      }

      if (a.nextAction) {
        out.push(`  - Next action: ${a.nextAction}`);
      }

      for (const b of a.blockers) {
        out.push(`  - Blocked: ${b}`);
      }
    }
  }

  const done = state.adrs.filter(
    (a) => a.status === "closed" || a.status === "abandoned",
  );

  if (done.length > 0) {
    out.push(
      "",
      `Closed: ${done.map((a) => `ADR-${a.id} (${a.statusLabel.replace(/^\S+\s*/u, "")})`).join(" · ")}.`,
    );
  }

  out.push(
    "",
    "For detail, open **the hub and its one open step** only (kuzzle-adr skill), never the frozen steps.",
  );

  return out.join("\n");
}

function main(args: string[]): number {
  const root =
    git(process.cwd(), ["rev-parse", "--show-toplevel"]) || process.cwd();
  const path = join(root, STATE_FILE);

  if (args.includes("--digest")) {
    // A broken state must not break the session: say so in one line instead.
    try {
      console.log(digest(JSON.parse(readFileSync(path, "utf8")), root));
    } catch (e) {
      console.log(
        `⚠️ ${STATE_FILE} unreadable (${(e as Error).message}): run \`node .ci/scripts/adr-state.ts --check\`.`,
      );
    }

    return 0;
  }

  const problems: string[] = [];
  const size = statSync(path).size;

  if (size > LIMITS.fileBytes) {
    problems.push(
      `${STATE_FILE}: ${size} bytes > ${LIMITS.fileBytes}: it holds state, not history; replace fields instead of appending to them`,
    );
  }

  let state: State | null = null;

  try {
    state = JSON.parse(readFileSync(path, "utf8")) as State;
  } catch (e) {
    problems.push(`${STATE_FILE}: invalid JSON (${(e as Error).message})`);
  }

  if (state) {
    problems.push(...validateState(state, root));

    const n = digest(state, root).length;

    if (n > LIMITS.digest) {
      problems.push(
        `session digest: ${n} chars > ${LIMITS.digest} (paid at every session): shorten nextAction / blockers of the live ADRs`,
      );
    }
  }

  for (const p of problems) {
    console.error(`❌ ${p}`);
  }

  if (problems.length > 0) {
    return 1;
  }

  console.log(`✅ ${STATE_FILE} matches its schema and the hubs`);

  return 0;
}

// Only when run as a script: tests/ci/adrState.test.ts imports the helpers.
if (process.argv[1]?.endsWith("adr-state.ts")) {
  process.exit(main(process.argv.slice(2)));
}
