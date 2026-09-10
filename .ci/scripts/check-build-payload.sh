#!/usr/bin/env bash
#
# Smoke check for `npm run build`'s payload.
#
# `tsc` emits the compiled JavaScript, and `bin/copy-binaries.ts` copies in what
# the compiler does not: the cluster's `.proto` definitions and the executable
# server entrypoint. Nothing used to assert that second half ran — and its
# failure mode is a *published package silently missing its `.proto` files*,
# which only surfaces when a cluster node boots.
#
# So the checks below are derived from `package.json`'s `files` list — the
# promise the package makes — rather than from a hand-written list that has to
# be remembered when `files` changes:
#
#   * a literal entry must exist;
#   * a glob over a **verbatim-copied** asset (`.json`, `.proto`, `.yaml`) must
#     match as many files under `dist/lib/` as exist under `lib/` — those are
#     emitted only because `tsconfig.json` includes `lib/**/*.json` with
#     `resolveJsonModule`, and dropping either leaves `tsc` exiting 0 with the
#     error-code catalogue missing from the package;
#   * any other glob (compiled `.js`, generated `.d.ts`) must match at least
#     once — there is no source file to count against.
#
# Runs on the PR workflow, on the release workflow, and — the one that gates the
# artifact actually published — from `prepublishOnly`, since `npm publish`
# re-runs `npm run build`, which wipes the `dist/` the workflow step verified.

set -euo pipefail

cd "$(dirname "$0")/../.."

# Extensions that reach `dist/` as byte-identical copies, so their count under
# `lib/` is the expected count under `dist/lib/`.
verbatim_extensions="json proto yaml yml"

failed=0

# Glob entries are counted with `find -path`, not with a shell glob: `globstar`
# is a bash-4 option and macOS still ships bash 3.2. The search is rooted at the
# pattern's first segment so it never walks node_modules.
count_matches() {
  local pattern="$1"
  find "${pattern%%/*}" -type f -path "$pattern" 2>/dev/null | wc -l | tr -d ' '
}

while IFS= read -r entry; do
  case "$entry" in
    *'*'*)
      extension="${entry##*.}"
      found="$(count_matches "$entry")"

      if [[ " $verbatim_extensions " == *" $extension "* && "$entry" == dist/* ]]; then
        expected="$(count_matches "${entry#dist/}")"

        if [ "$found" -lt "$expected" ]; then
          echo "❌ $entry — $found file(s), expected $expected (one per source file)"
          failed=1
        else
          echo "✅ $entry — $found file(s)"
        fi
      elif [ "$found" -eq 0 ]; then
        echo "❌ $entry — no match"
        failed=1
      else
        echo "✅ $entry — $found file(s)"
      fi
      ;;
    *)
      if [ -e "$entry" ]; then
        echo "✅ $entry"
      else
        echo "❌ MISSING: $entry"
        failed=1
      fi
      ;;
  esac
done < <(node -e 'for (const f of require("./package.json").files) console.log(f)')

# `start-kuzzle-server` is the container's entrypoint: it has to stay executable
# through the copy, which is why copy-binaries chmods it explicitly.
if [ -f "dist/bin/start-kuzzle-server" ] && [ ! -x "dist/bin/start-kuzzle-server" ]; then
  echo "❌ dist/bin/start-kuzzle-server is not executable"
  failed=1
fi

if [ "$failed" -ne 0 ]; then
  echo
  echo "The build payload is incomplete — 'tsc' may have succeeded while"
  echo "bin/copy-binaries.ts did not run, or 'files' promises a path the build"
  echo "no longer produces. See docs/adr-001/steps/08-type-debt-backlog.md."
  exit 1
fi

echo
echo "✅ build payload complete."
