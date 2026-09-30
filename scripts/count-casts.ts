/**
 * Counts the type assertions in `lib/**\/*.ts` for the `casts` ratchet — see
 * docs/adr-001/type-debt-register.md (TD-43) and scripts/ratchet.sh.
 *
 * WHY A PARSER AND NOT A GREP
 * ---------------------------
 * TD-43 was filed with the predicate `as [A-Z]` and the count "16". Over the
 * tree that grep finds **84** matches, and most of them are not assertions at
 * all: `import * as Cookie from …`, and prose — "tracked as TD-43", "parsed as
 * JSON", "Kuzzle ships as CommonJS". A ratchet whose predicate fires on an
 * English sentence teaches contributors to reword comments, so this walks the
 * TypeScript AST instead and counts assertion *nodes*.
 *
 * Nodes, not lines: the `any` ratchet counts matching lines, which lets a
 * second `any` on an already-counted line in for free. There is no reason to
 * repeat that here.
 *
 * WHAT COUNTS
 * -----------
 * - `expr as T` (`AsExpression`) and `<T>expr` (`TypeAssertionExpression`),
 *   which is the same escape hatch in the syntax `.ts` files may still use.
 *
 * WHAT DOES NOT, AND WHY
 * ----------------------
 * - `as const` — an assertion that only ever *narrows* to what is already
 *   written. It cannot assert a wrong type, which is the whole hazard TD-43 is
 *   about.
 * - `as any`, `as unknown`, and both halves of an `as unknown as T` /
 *   `as any as T` chain —
 *   already charged for by the `any` ratchet. Counting them here would make one
 *   line of debt cost two, and a PR that removes a double cast would have to
 *   update two baselines.
 * - `satisfies T` — checked against the annotation rather than asserted over
 *   it, so it is the fix, not the hatch.
 * - Non-null assertions (`x!`) — a different hatch, with a different cost;
 *   TD-43 does not cover them and neither does this.
 *
 * Usage: `npx tsx scripts/count-casts.ts [--list]`
 * Prints the count; with `--list`, one `file:line: text` per assertion first.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import ts from "typescript";

const ROOT = resolve(__dirname, "..");

function tsFilesUnder(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);

    if (entry.isDirectory()) {
      return tsFilesUnder(path);
    }

    return entry.isFile() && path.endsWith(".ts") && !path.endsWith(".d.ts")
      ? [path]
      : [];
  });
}

/**
 * `as const` parses as a type *reference* whose name is the identifier
 * `const` — there is no `ConstKeyword` type node — so it has to be recognised
 * by name rather than by kind.
 */
function isConstAssertion(type: ts.TypeNode): boolean {
  return (
    ts.isTypeReferenceNode(type) &&
    ts.isIdentifier(type.typeName) &&
    type.typeName.escapedText === "const"
  );
}

/** The two keywords the `any` ratchet already owns. */
function isAnyRatchetType(type: ts.TypeNode): boolean {
  return (
    type.kind === ts.SyntaxKind.AnyKeyword ||
    type.kind === ts.SyntaxKind.UnknownKeyword
  );
}

/**
 * The outer half of `x as unknown as T` — or of `x as any as T`, which
 * `lib/kerror/index.ts` writes. Its inner expression is itself an assertion to
 * the widest type, which is what makes the pair a double cast rather than two
 * independent ones, and the `any` ratchet already charges for the line.
 */
function isDoubleCastTail(node: ts.AsExpression): boolean {
  const inner = node.expression;

  return ts.isAsExpression(inner) && isAnyRatchetType(inner.type);
}

function counts(node: ts.AsExpression | ts.TypeAssertion): boolean {
  if (isConstAssertion(node.type) || isAnyRatchetType(node.type)) {
    return false;
  }

  return !(ts.isAsExpression(node) && isDoubleCastTail(node));
}

const found: string[] = [];

for (const path of tsFilesUnder(resolve(ROOT, "lib")).sort()) {
  const source = ts.createSourceFile(
    path,
    readFileSync(path, "utf8"),
    ts.ScriptTarget.Latest,
    /* setParentNodes */ false,
    ts.ScriptKind.TS,
  );

  const visit = (node: ts.Node): void => {
    if (
      (ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)) &&
      counts(node)
    ) {
      const { line } = source.getLineAndCharacterOfPosition(
        node.getStart(source),
      );

      found.push(
        `${relative(ROOT, path)}:${line + 1}: ${node.getText(source).replace(/\s+/gu, " ").slice(0, 120)}`,
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
