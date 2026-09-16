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

# The verdict below is derived from grepping this log for `error TS`, so a tsc
# that never got as far as reporting diagnostics — an OOM kill, a malformed
# tsconfig.strict.json, a missing `typescript` after a bad install — would
# produce an empty log and be read as "every adopted file passes". This check
# guards the files in $ADOPTED and is the one the whole migration ratchets
# against; it must fail closed. See ADR-0001 type-debt register, TD-44 (#2731).
#
# The exit status alone cannot tell the two cases apart — tsc returns non-zero
# both for "I found errors in your code" and for "I could not run" — so the
# discriminator is the output itself: a run that checked anything and is
# unhappy says so on a `path(line,col): error TSxxxx` line.
npx tsc -p tsconfig.strict.json --noEmit > "$LOG" 2>&1
tsc_status=$?

# A config- or CLI-level diagnostic (TS5xxx/TS6xxx/TS18003) is printed with no
# `path(line,col)` prefix. It means tsc never read the project we asked for —
# and it does not stop tsc from then compiling something else entirely and
# filling the log with perfectly real diagnostics about the wrong files.
if grep -qE '^error TS' "$LOG"; then
  echo "❌ strict: tsc could not read tsconfig.strict.json — it checked something else, or nothing:" >&2
  grep -E '^error TS' "$LOG" | head -5 >&2
  exit 2
fi

# Unhappy, but with nothing to say about any file: it did not get far enough to
# check one.
if [ "$tsc_status" -ne 0 ] && ! grep -qE '^[^ ].*\([0-9]+,[0-9]+\): error TS' "$LOG"; then
  echo "❌ strict: tsc exited $tsc_status without reporting a single file diagnostic," >&2
  echo "   which means it did not check anything. First lines of its output:" >&2
  sed -n '1,20p' "$LOG" >&2
  exit 2
fi

# A declaration that lies: a non-nullable type assigned `undefined`, or a
# function whose declared return type has no path returning it (TS2366). This
# is checked over the WHOLE program — adopted or not — because it is the one
# defect class the adoption list cannot help with: TD-40 was found by strict in
# an adopted file, and TD-56 is the same defect two sprints later in a file
# strict does not read. *A ratchet a file is exempt from cannot catch the
# defect it exists for* (ADR-0001, TD-56).
#
# Deliberately narrow. It is not "strict everywhere" — the other ~1 600
# diagnostics are TD-54's per-file triage — only the subset where the type
# states something the code contradicts on the very line, with no guard to
# write and nothing to decide.
#
# The `Type 'null'` variant is the same lie at a scale this gate cannot carry
# yet: 56 sites, most of them `x: T = null` field initialisers. See TD-62.
check_lies() {
  grep -E "error (TS2366|TS2322: Type 'undefined' is not assignable)" "$LOG" || true
}

if [ "${1:-}" = "--lies" ]; then
  check_lies
  exit 0
fi

# Per-file error counts, for files that do NOT pass strict. The other half of
# --candidates: that one answers "what is ready to adopt", this one answers "how
# far is what I just converted" — the number a conversion PR owes per
# ADR-0001 (TD-54, #2757). Both read the same log, so both inherit the
# fail-closed guards above: a count of 0 here means tsc checked the file and
# found nothing, never that tsc did not run.
#
#   scripts/strict-check.sh --count                 # every unadopted file with errors
#   scripts/strict-check.sh --count lib/a.ts lib/b.ts
if [ "${1:-}" = "--count" ]; then
  shift
  errored="$(grep -oE '^(lib/[^(]+\.ts|index\.ts)' "$LOG" | sort | uniq -c | awk '{print $2" "$1}')"

  if [ "$#" -gt 0 ]; then
    miss=0
    for path in "$@"; do
      # "0" must mean "tsc checked it and found nothing", never "tsc never saw
      # this path" — a typo would otherwise read as a clean file (TD-44).
      if [ ! -f "$path" ]; then
        echo "?? $path (no such file)" >&2
        miss=1
        continue
      fi
      n="$(printf '%s\n' "$errored" | awk -v p="$path" '$1 == p { print $2 }')"
      echo "${n:-0} $path"
    done
    exit "$miss"
  fi

  adopted="$(grep -vE '^[[:space:]]*(#|$)' "$ADOPTED" 2>/dev/null | sort -u)"
  printf '%s\n' "$errored" \
    | while read -r path n; do
        [ -n "$path" ] || continue
        printf '%s\n' "$adopted" | grep -qxF "$path" || echo "$n $path"
      done \
    | sort -rn
  exit 0
fi

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
adopted_failed=""

lies="$(check_lies)"
if [ -n "$lies" ]; then
  echo "❌ strict: a declaration that lies — a non-nullable type assigned \`undefined\`:"
  printf '%s\n' "$lies" | sed 's/^/   /'
  echo "   Widen the declaration or stop assigning undefined. This one is checked"
  echo "   everywhere, adopted or not (ADR-0001, TD-56)."
  echo ""
  fail=1
fi
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
    adopted_failed=1
  fi
done < "$ADOPTED"

# An empty or unreadable adopted list would otherwise print a green
# "all 0 adopted file(s) pass" (TD-44).
if [ "$count" -eq 0 ]; then
  echo "❌ strict: $ADOPTED yielded no file to check." >&2
  exit 2
fi

if [ "$fail" -eq 0 ]; then
  echo "✅ strict: all $count adopted file(s) pass."
elif [ -n "$adopted_failed" ]; then
  echo ""
  echo "→ Fix the errors above, or temporarily remove the file from $ADOPTED."
  echo "  (A lying declaration is not covered by that escape: it is checked"
  echo "   whether or not the file is adopted.)"
fi
exit "$fail"
