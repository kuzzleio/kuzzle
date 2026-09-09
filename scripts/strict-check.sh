#!/usr/bin/env bash
#
# Progressive strict check — see docs/adr-001/steps/01-sprint-0-tooling.md.
#
# Runs tsc with `strict: true` over all production .ts (tsconfig.strict.json), but only
# FAILS on strict errors located in files listed in .migration/strict-adopted.txt.
# Harden a file so it passes strict, add its path to that list, and this ratchet guards
# it from then on. Final state: the list covers all of lib/, then `strict` is flipped in
# tsconfig.json and this machinery is removed.
#
# Usage:
#   scripts/strict-check.sh              # CI: fail if any adopted file has a strict error
#   scripts/strict-check.sh --candidates # list production .ts that pass strict but aren't adopted yet
#
set -uo pipefail
cd "$(dirname "$0")/.."

ADOPTED=".migration/strict-adopted.txt"
LOG="$(mktemp)"
trap 'rm -f "$LOG"' EXIT

npx tsc -p tsconfig.strict.json --noEmit > "$LOG" 2>&1 || true

if [ "${1:-}" = "--candidates" ]; then
  errored="$(grep -oE '^(lib/[^(]+\.ts|index\.ts)' "$LOG" | sort -u)"
  all="$( { find lib -name '*.ts'; echo index.ts; } | sort -u )"
  adopted="$(grep -vE '^[[:space:]]*(#|$)' "$ADOPTED" 2>/dev/null | sort -u)"
  echo "# Production files that pass strict but are not adopted yet:"
  comm -23 <(comm -23 <(printf '%s\n' "$all") <(printf '%s\n' "$errored")) <(printf '%s\n' "$adopted")
  exit 0
fi

fail=0
count=0
while IFS= read -r path; do
  case "$path" in ''|\#*) continue;; esac
  count=$((count + 1))
  # tsc error lines look like:  lib/foo/bar.ts(12,3): error TS2345: ...
  # The path must be anchored at the start of the line: an unanchored substring
  # match makes a bare "index.ts" entry swallow every "lib/**/index.ts" error.
  hits="$(grep -E "^$(printf '%s' "$path" | sed 's/[.[\*^$/]/\\&/g')\(" "$LOG" | grep 'error TS' || true)"
  if [ -n "$hits" ]; then
    echo "❌ strict: errors in an adopted file: $path"
    printf '%s\n' "$hits" | head -10
    fail=1
  fi
done < "$ADOPTED"

if [ "$fail" -eq 0 ]; then
  echo "✅ strict: all $count adopted file(s) pass."
else
  echo ""
  echo "→ Fix the errors above, or temporarily remove the file from $ADOPTED."
fi
exit "$fail"
