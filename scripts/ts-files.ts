import { readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * The `.ts` files under `dir`, recursively and sorted, for the AST-based
 * ratchet counters (scripts/count-any.ts, scripts/count-casts.ts).
 * Declaration files are left out unless `withDeclarations` is set.
 */
export function tsFilesUnder(
  dir: string,
  { withDeclarations = false } = {},
): string[] {
  const walk = (current: string): string[] =>
    readdirSync(current, { withFileTypes: true }).flatMap((entry) => {
      const path = join(current, entry.name);

      if (entry.isDirectory()) {
        return walk(path);
      }

      const wanted =
        entry.isFile() &&
        path.endsWith(".ts") &&
        (withDeclarations || !path.endsWith(".d.ts"));

      return wanted ? [path] : [];
    });

  return walk(dir).sort();
}
