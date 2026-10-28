/* eslint-disable no-console -- a CLI: its report is its output */
/**
 * Bounds the repository's own living documentation.
 *
 * ADR-0001's hub was compacted on 2026-09-18 and was back at 116 KB nine days
 * later: every pass appended a dated report to its cold start and its decision
 * register, and nothing said no. The same thing had happened on paas-console,
 * where this check comes from. This script is the "no".
 *
 * Budgets are declared per glob in `docs/doc-budgets.json`, each with a role:
 * `living` (bounded), `archive` (write-once, exempt, flagged if it grows),
 * `exempt`, or `step` (living while its `**Status:**` line is open, archive
 * once closed). Every file of an ADR whose hub says Closed or Abandoned is
 * archive, whatever its rule.
 *
 *   node .ci/scripts/check-doc-budgets.ts                    # every tracked .md
 *   node .ci/scripts/check-doc-budgets.ts --base origin/2-dev
 *        # + warns about archives that grew since the base
 *   node .ci/scripts/check-doc-budgets.ts docs/adr-003/ADR-0003-storage-drivers.md
 *   node .ci/scripts/check-doc-budgets.ts --hook             # Claude Code PostToolUse
 *
 * Exits 1 when a living file is over budget. Warnings (≥ 90% of a budget, an
 * archive that grew) do not fail. Node builtins only, and run by Node's own
 * type stripping, so the CI job needs no `npm ci`: keep the syntax erasable.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const KB = 1000;
const WARN_RATIO = 0.9;
const BUDGETS_FILE = "docs/doc-budgets.json";

export type Role = "living" | "archive" | "exempt" | "step";

export interface Rule {
  pattern: string;
  role: Role;
  maxKB?: number;
  advice?: string;
  why?: string;
}

export interface ResolvedRule extends Rule {
  role: Exclude<Role, "step">;
  detail?: string;
}

export interface Budgets {
  default: Rule;
  rules: Array<Rule & { re: RegExp }>;
}

export interface Finding {
  file: string;
  message: string;
}

export interface Line {
  rel: string;
  size: number;
  rule: ResolvedRule;
}

/** Minimal glob: `**` (anything, `/` included), `*` (no `/`), `?`. Anchored on the whole path. */
export function globToRegExp(glob: string): RegExp {
  let re = "";

  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];

    if (c === "*" && glob[i + 1] === "*") {
      i++;

      if (glob[i + 1] === "/") {
        i++;
        re += "(?:.*/)?";
      } else {
        re += ".*";
      }
    } else if (c === "*") {
      re += "[^/]*";
    } else if (c === "?") {
      re += "[^/]";
    } else {
      re += c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
    }
  }

  return new RegExp(`^${re}$`);
}

export function loadBudgets(root: string): Budgets {
  const cfg = JSON.parse(readFileSync(join(root, BUDGETS_FILE), "utf8")) as {
    default: Rule;
    rules: Rule[];
  };

  return {
    default: cfg.default,
    rules: cfg.rules.map((r) => ({ ...r, re: globToRegExp(r.pattern) })),
  };
}

/**
 * The state a `**Status:**` line declares, read from its first emoji:
 * ⬜ / 🟦 open, ✅ / 🧊 / 🚫 closed. A step file with no status line is
 * treated as open: it is bounded until it says otherwise.
 */
export function stepStatus(text: string): { open: boolean; label: string } {
  const line = text.split("\n").find((l) => l.startsWith("**Status:**"));

  if (!line) {
    return { label: "no **Status:** line", open: true };
  }

  const value = line.slice("**Status:**".length).trim();
  const label = value.slice(0, 40);

  if (/^(✅|🧊|🚫)/u.test(value)) {
    return { label, open: false };
  }

  return { label, open: true };
}

/** True when `text` is an ADR hub whose status is Closed or Abandoned. */
export function isFrozenHub(text: string): boolean {
  const line = text.split("\n").find((l) => l.startsWith("**Status:**"));

  return (
    line !== undefined &&
    /^\*\*Status:\*\*[\s*_]*(Closed|Abandoned)\b/i.test(line)
  );
}

function frozenAdr(root: string, rel: string): string | null {
  const m = /^(docs\/adr-[^/]+)\//.exec(rel);

  if (!m) {
    return null;
  }

  const dir = join(root, m[1]);

  if (!existsSync(dir)) {
    return null;
  }

  const hub = readdirSync(dir).find((f) => /^ADR-.*\.md$/.test(f));

  if (!hub) {
    return null;
  }

  return isFrozenHub(readFileSync(join(dir, hub), "utf8")) ? hub : null;
}

/** The rule that applies to `rel` (relative to `root`, `/`-separated). */
export function resolveRule(
  root: string,
  rel: string,
  budgets: Budgets,
): ResolvedRule {
  const rule: Rule = budgets.rules.find((r) => r.re.test(rel)) ?? {
    ...budgets.default,
    pattern: "(default)",
  };

  if (rule.role === "exempt") {
    return { ...rule, role: "exempt" };
  }

  const hub = frozenAdr(root, rel);

  if (hub) {
    return { ...rule, detail: `ADR frozen (${hub})`, role: "archive" };
  }

  if (rule.role !== "step") {
    return { ...rule, role: rule.role };
  }

  const status = stepStatus(readFileSync(join(root, rel), "utf8"));

  return status.open
    ? { ...rule, detail: `open step (${status.label})`, role: "living" }
    : { ...rule, detail: `closed step (${status.label})`, role: "archive" };
}

export function checkFiles(
  root: string,
  rels: string[],
  budgets: Budgets = loadBudgets(root),
): { errors: Finding[]; warnings: Finding[]; lines: Line[] } {
  const errors: Finding[] = [];
  const warnings: Finding[] = [];
  const lines: Line[] = [];

  for (const rel of rels) {
    const rule = resolveRule(root, rel, budgets);
    const size = statSync(join(root, rel)).size;
    lines.push({ rel, rule, size });

    if (rule.role !== "living" || rule.maxKB === undefined) {
      continue;
    }

    const max = rule.maxKB * KB;
    const kind = rule.detail ? ` — ${rule.detail}` : "";

    if (size > max) {
      errors.push({
        file: rel,
        message: `${fmtKB(size)} > budget ${rule.maxKB} KB (${rule.pattern}${kind}). To do: ${rule.advice ?? "move the content where it belongs"}.`,
      });
    } else if (size >= max * WARN_RATIO) {
      warnings.push({
        file: rel,
        message: `${fmtKB(size)}, ${Math.round((size / max) * 100)}% of its ${rule.maxKB} KB budget: the next pass must remove as much as it adds.`,
      });
    }
  }

  return { errors, lines, warnings };
}

/** Archives (write-once) that grew by more than 1 KB since `base`. */
export function checkArchiveGrowth(
  root: string,
  base: string,
  lines: Line[],
): Finding[] {
  const out: Finding[] = [];

  for (const { rel, size, rule } of lines) {
    if (rule.role !== "archive") {
      continue;
    }

    let before: number;

    try {
      before = Buffer.byteLength(
        execFileSync("git", ["show", `${base}:${rel}`], {
          cwd: root,
          encoding: "utf8",
          stdio: ["ignore", "pipe", "ignore"],
        }),
      );
    } catch {
      continue; // a new archive file (an eviction, a frozen step) is legitimate
    }

    if (size - before > KB) {
      out.push({
        file: rel,
        message: `write-once archive grew by ${fmtKB(size - before)} since ${base} (${rule.detail ?? rule.pattern}). Legitimate only for a verbatim eviction from a living file; new narrative goes in the open step.`,
      });
    }
  }

  return out;
}

function listFiles(root: string): string[] {
  return execFileSync("git", ["ls-files", "-z", "--", "*.md"], {
    cwd: root,
    encoding: "utf8",
  })
    .split("\0")
    .filter(Boolean)
    .filter((f) => existsSync(join(root, f))); // tracked but deleted (a git mv in progress)
}

function fmtKB(n: number): string {
  return `${(n / KB).toFixed(1)} KB`;
}

function findRoot(file: string): string | null {
  let dir = dirname(file);

  while (dir !== dirname(dir)) {
    if (existsSync(join(dir, BUDGETS_FILE))) {
      return dir;
    }

    dir = dirname(dir);
  }

  return null;
}

/**
 * PostToolUse (Edit|Write|MultiEdit): warns the agent as soon as an edit pushes
 * a living document over its budget. Never blocking — the write already
 * happened, and the CI job is the gate; this only makes sure the agent learns
 * it before the push, with the advice saying where the content belongs.
 */
function hook(): number {
  let file: string | undefined;

  try {
    const input = JSON.parse(readFileSync(0, "utf8")) as {
      tool_input?: { file_path?: string };
    };
    file = input.tool_input?.file_path;
  } catch {
    return 0;
  }

  if (!file || !file.endsWith(".md")) {
    return 0;
  }

  // The file's own worktree, not necessarily the project's: each worktree has
  // its own budgets.
  const root = findRoot(file);

  if (!root) {
    return 0;
  }

  const rel = relative(root, file).split("\\").join("/");

  if (rel.startsWith("..") || !existsSync(file)) {
    return 0;
  }

  const { errors } = checkFiles(root, [rel]);

  if (errors.length === 0) {
    return 0;
  }

  const msg = [
    `Documentation budget exceeded (${BUDGETS_FILE}); the "Documentation budgets" CI job will fail the PR as it stands:`,
    ...errors.map((e) => `- ${e.file}: ${e.message}`),
    "Do not compress into abbreviations: move the content where it belongs (kuzzle-adr skill, § Budgets).",
  ].join("\n");

  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        additionalContext: msg,
        hookEventName: "PostToolUse",
      },
    }),
  );

  return 0;
}

function main(args: string[]): number {
  if (args.includes("--hook")) {
    return hook();
  }

  const root = resolve(
    execFileSync("git", ["rev-parse", "--show-toplevel"], {
      encoding: "utf8",
    }).trim(),
  );
  const baseIdx = args.indexOf("--base");
  const base = baseIdx >= 0 ? args[baseIdx + 1] : undefined;
  const explicit = args.filter(
    (a, i) => !a.startsWith("--") && !(baseIdx >= 0 && i === baseIdx + 1),
  );
  const rels = explicit.length
    ? explicit.map((f) => relative(root, resolve(f)).split("\\").join("/"))
    : listFiles(root);

  const { errors, warnings, lines } = checkFiles(root, rels);

  if (base) {
    warnings.push(...checkArchiveGrowth(root, base, lines));
  }

  const living = lines.filter((l) => l.rule.role === "living").length;
  console.log(
    `Documentation budgets: ${lines.length} files, ${living} living and bounded, ${lines.length - living} archive/exempt (rules: ${BUDGETS_FILE})`,
  );

  const gha = process.env.GITHUB_ACTIONS === "true";

  for (const w of warnings) {
    console.log(`⚠️  ${w.file}: ${w.message}`);

    if (gha) {
      console.log(`::warning file=${w.file}::${w.message}`);
    }
  }

  for (const e of errors) {
    console.error(`❌ ${e.file}: ${e.message}`);

    if (gha) {
      console.log(`::error file=${e.file}::${e.message}`);
    }
  }

  if (errors.length > 0) {
    console.error(
      `\n${errors.length} over budget. A budget is raised by a reasoned edit of ${BUDGETS_FILE}, never to let a journal through (kuzzle-adr skill, § Budgets).`,
    );

    return 1;
  }

  console.log("✅ Living documentation within its budgets");

  return 0;
}

// Only when run as a script: tests/ci/docBudgets.test.ts imports the helpers.
if (process.argv[1]?.endsWith("check-doc-budgets.ts")) {
  process.exit(main(process.argv.slice(2)));
}
