/**
 * Counts the `any` escape hatches in `lib/**\/*.ts` for the `any` ratchet —
 * see scripts/ratchet.sh and docs/adr-001/type-debt-register.md (TD-73).
 *
 * WHY A PARSER AND NOT A GREP
 * ---------------------------
 * The ratchet used to run `grep -rE ': any|as any|as unknown as'` and count
 * matching lines. That is the defect TD-43 already fixed for `casts`
 * (scripts/count-casts.ts), left in place on the sibling ratchet:
 *
 * - it counted prose: "total: anything else" in a doc comment is one `: any`;
 * - it counted lines: a Prettier split of one signature over three lines turned
 *   two annotations into two hits, and two `any` on one line cost one;
 * - it missed every `any` not preceded by `: ` or `as ` — `Promise<any>`,
 *   `Record<string, any>`, `(...args: unknown[]) => any`.
 *
 * WHAT COUNTS
 * -----------
 * - Every `any` keyword in a type position (`AnyKeyword` node): annotations,
 *   assertions, type arguments, return types, `any[]`. This is what
 *   `@typescript-eslint/no-explicit-any` reports, so the ratchet reaching 0 is
 *   the precondition for turning that rule into an error (TD-02).
 * - `as unknown as T`, once per chain: the hatch a conversion reaches for once
 *   `any` is forbidden. The outer assertion is the one counted, so `x as unknown`
 *   alone — a widening before narrowing — is not.
 *
 * Ambient declarations (`lib/types/*.d.ts`) are counted too: an `any` written
 * there is as much debt as one written in an implementation file.
 *
 * Usage: `npx tsx scripts/count-any.ts [--list]`
 * Prints the count; with `--list`, one `file:line: text` per occurrence first.
 */

import { readFileSync } from "node:fs";
import { relative, resolve } from "node:path";

import ts from "typescript";

import { tsFilesUnder } from "./ts-files";

const ROOT = resolve(__dirname, "..");

function isDoubleCastThroughUnknown(node: ts.Node): boolean {
  return (
    ts.isAsExpression(node) &&
    ts.isAsExpression(node.expression) &&
    node.expression.type.kind === ts.SyntaxKind.UnknownKeyword
  );
}

const found: string[] = [];

for (const path of tsFilesUnder(resolve(ROOT, "lib"), {
  withDeclarations: true,
})) {
  const source = ts.createSourceFile(
    path,
    readFileSync(path, "utf8"),
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    ts.ScriptKind.TS,
  );

  const visit = (node: ts.Node): void => {
    const isAny = node.kind === ts.SyntaxKind.AnyKeyword;

    if (isAny || isDoubleCastThroughUnknown(node)) {
      const { line } = source.getLineAndCharacterOfPosition(
        node.getStart(source),
      );
      // A bare `any` says nothing on its own: show the node it sits in.
      const shown = isAny ? node.parent : node;

      found.push(
        `${relative(ROOT, path)}:${line + 1}: ${shown.getText(source).replace(/\s+/gu, " ").slice(0, 120)}`,
      );
    }

    ts.forEachChild(node, visit);
  };

  visit(source);
}

if (process.argv.includes("--list")) {
  for (const entry of found) {
    console.log(entry);
  }
}

console.log(found.length);
