#!/usr/bin/env bash
#
# TypeScript-migration ratchets — see docs/adr-001/steps/01-sprint-0-tooling.md.
#
# A tracked metric may only DECREASE. The baseline file (.migration/*-baseline.txt)
# records the EXACT current value; every migration PR that improves a metric must
# update its baseline in the same PR (part of the PR's definition of done). CI runs
# these in "check" mode and fails on any regression (and, deliberately, on an
# unrecorded improvement — so the baseline always mirrors reality).
#
# Usage:
#   scripts/ratchet.sh <js|mocha|any|implicit-any|casts|cpd-exclusions> [--update]
#   npm run ratchet                  # all six, check mode
#   npm run ratchet:js -- --update   # record the current js count as the new baseline
#
set -euo pipefail

cd "$(dirname "$0")/.."

metric="${1:-}"
mode="${2:-check}"

# The CPD-exclusion ratchet is a SET, not a count: a count alone would let a PR
# swap an entry out for a new one. `sonar.cpd.exclusions` disables duplication
# detection on a file for every future PR, so the list may only shrink, and only
# as a file's duplication is actually dealt with (ADR-0001 register, TD-23).
if [ "$metric" = "cpd-exclusions" ]; then
  baseline_file=".migration/cpd-exclusions.txt"

  current="$(grep '^sonar.cpd.exclusions=' sonar-project.properties \
    | cut -d= -f2- | tr ',' '\n' | sed '/^[[:space:]]*$/d' | sort)"

  if [ "$mode" = "--update" ]; then
    {
      echo "# Files excluded from SonarCloud duplication detection — see sonar-project.properties"
      echo "# and docs/adr-001/type-debt-register.md (TD-23). This list may only SHRINK: drop a"
      echo "# file's entry in the PR that deals with its duplication."
      echo
      echo "$current"
    } > "$baseline_file"
    echo "✅ 'cpd-exclusions' baseline updated:"
    echo "$current" | sed 's/^/   /'
    exit 0
  fi

  if [ ! -f "$baseline_file" ]; then
    echo "❌ missing baseline: $baseline_file (run: scripts/ratchet.sh cpd-exclusions --update)" >&2
    exit 2
  fi

  baseline="$(sed 's/#.*//' "$baseline_file" | sed '/^[[:space:]]*$/d' | sort)"

  added="$(comm -13 <(echo "$baseline") <(echo "$current"))"
  removed="$(comm -23 <(echo "$baseline") <(echo "$current"))"

  if [ -n "$added" ]; then
    echo "❌ 'cpd-exclusions' ratchet: new exclusion(s) added — not allowed."
    echo "$added" | sed 's/^/   + /'
    echo "   → Dedupe the file instead. An exclusion disables CPD on it for every future PR."
    exit 1
  fi

  if [ -n "$removed" ]; then
    echo "🎉 Progress on 'cpd-exclusions': exclusion(s) dropped."
    echo "$removed" | sed 's/^/   - /'
    echo "   Update the baseline in the same PR: npm run ratchet:cpd-exclusions -- --update"
    echo "   then commit $baseline_file."
    exit 1
  fi

  echo "✅ 'cpd-exclusions' ratchet: $(echo "$baseline" | wc -l | tr -d ' ') exclusion(s), unchanged."
  exit 0
fi

case "$metric" in
  js)
    label="JavaScript files under lib/ and bin/"
    baseline_file=".migration/js-baseline.txt"
    # Extension AND shebang: bin/ holds Node executables with no extension at
    # all (bin/wait-kuzzle, bin/start-kuzzle-server), which a `-name '*.js'`
    # predicate cannot see. They went uncounted from the start, so the floor
    # this ratchet reports was wrong by two — and #2719 could add 100 lines of
    # JavaScript to bin/wait-kuzzle during a TypeScript migration without the
    # ratchet noticing. See ADR-0001 type-debt register, TD-45 (#2732), and
    # TD-30 (#2705) for the same class of defect in the other direction.
    current="$(
      {
        find lib bin -type f -name '*.js'
        find lib bin -type f ! -name '*.*' -exec grep -lE '^#!.*\bnode\b' {} +
      } | sort -u | wc -l | tr -d ' '
    )"
    hint="Write new code in .ts — no new JavaScript under lib/ or bin/, extension or not."
    ;;
  mocha)
    label="Mocha specs (test/**/*.test.js)"
    baseline_file=".migration/mocha-baseline.txt"
    current="$(find test -type f -name '*.test.js' | wc -l | tr -d ' ')"
    hint="Write new unit tests in vitest + TS (ADR-0001 › Tests)."
    ;;
  any)
    # 'as unknown as' is counted too: it is the escape hatch a conversion reaches
    # for once ': any' is forbidden, so leaving it out would just move the debt.
    label="': any' / 'as any' / 'as unknown as' lines in lib/**/*.ts"
    baseline_file=".migration/any-baseline.txt"
    current="$(grep -rE ': any|as any|as unknown as' lib --include='*.ts' 2>/dev/null | wc -l | tr -d ' ')"
    hint="Type explicitly instead of 'any' (prefer 'unknown' + narrowing if dynamic)."
    ;;
  implicit-any)
    # The 'any' ratchet only sees WRITTEN any. This one sees INFERRED any: the
    # TS7xxx diagnostics tsc reports on lib/ + index.ts under 'noImplicitAny'
    # (strict off, to isolate the signal — see tsconfig.implicit.json). An
    # un-annotated parameter is free for the 'any' ratchet but costs here.
    label="implicit-any (TS7xxx) diagnostics in lib/ + index.ts"
    baseline_file=".migration/implicit-any-baseline.txt"
    #
    # Fail CLOSED. A tsc that never compiled anything — a missing compiler, a
    # malformed tsconfig, an OOM kill, a half-installed node_modules — still
    # prints something, and none of it matches 'error TS7xxx'. Without the
    # check below, `grep -c` answers 0, the `|| true` swallows the failure, and
    # the ratchet reports "0 < baseline" as PROGRESS, telling the caller to
    # write 0 into the baseline and disarm the ratchet for good.
    #
    # This is TD-44 (#2731) in a sibling script: `strict-check.sh` read an empty
    # tsc log as "all adopted files pass" for the same reason, and the fix there
    # is the discriminator used here — a run that checked anything and is
    # unhappy says so on a `path(line,col): error TSxxxx` line. 0 is a legitimate
    # answer one day, so the test is "did tsc run", never "is the count small".
    ia_log="$(mktemp)"
    npx tsc -p tsconfig.implicit.json --noEmit > "$ia_log" 2>&1 && ia_status=0 || ia_status=$?

    # A tsc that ran says one of exactly two things: nothing at all (a clean
    # compile under --noEmit), or `path(line,col): error TSxxxx` lines. Anything
    # else means it did not check this project, whatever it exited with — and
    # the exit code alone is not enough: with no local typescript installed,
    # `npx tsc` prints "This is not the tsc command you are looking for" and
    # exits **0**, which is the case that actually happened (#2793).
    if [ -s "$ia_log" ] && ! grep -qE '^[^ ].*\([0-9]+,[0-9]+\): error TS' "$ia_log"; then
      echo "❌ 'implicit-any': tsc exited $ia_status but reported no file diagnostic," >&2
      echo "   so it did not check anything. First lines of its output:" >&2
      sed -n '1,20p' "$ia_log" >&2
      rm -f "$ia_log"
      exit 2
    fi

    current="$(grep -cE 'error TS7[0-9]{3}' "$ia_log" || true)"
    rm -f "$ia_log"
    hint="Annotate the parameter/variable instead of letting it infer to any."
    ;;
  casts)
    # The 'any' ratchet counts the hatches it was told about — ': any', 'as any',
    # 'as unknown as'. 'as SomeType' is the NEXT one, and the debt moved there
    # exactly as that comment predicted (ADR-0001 register, TD-43). It is the
    # worse hatch of the two: 'any' degrades to a permissive type and strict
    # can still be pointed at it later, while a wrong 'as T' asserts a specific
    # WRONG type, silently, and every gate downstream believes it.
    #
    # Counted by parsing, not grepping: over lib/ the filed 'as [A-Z]' predicate
    # matches 84 times and most are 'import * as Cookie' or English prose. See
    # scripts/count-casts.ts for what counts and, more importantly, what does not.
    label="type assertions in lib/**/*.ts"
    baseline_file=".migration/casts-baseline.txt"
    #
    # Fail CLOSED, same reasoning as 'implicit-any' above: `tail -n 1` of a
    # crashed script is a stack trace line, not a count. The counter must exit
    # 0 and its last line must be a number.
    casts_out="$(npx tsx scripts/count-casts.ts 2>&1)" && casts_status=0 || casts_status=$?
    current="$(printf '%s\n' "$casts_out" | tail -n 1)"

    if [ "$casts_status" -ne 0 ] || ! printf '%s' "$current" | grep -qE '^[0-9]+$'; then
      echo "❌ 'casts': scripts/count-casts.ts exited $casts_status and its last line" >&2
      echo "   is not a count, so nothing was measured. Its output:" >&2
      printf '%s\n' "$casts_out" | sed -n '1,20p' >&2
      exit 2
    fi

    hint="Narrow instead of asserting (type guard, 'satisfies', or fix the source type)."
    ;;
  *)
    echo "usage: scripts/ratchet.sh <js|mocha|any|implicit-any|casts|cpd-exclusions> [--update]" >&2
    exit 2
    ;;
esac

if [ "$mode" = "--update" ]; then
  echo "$current" > "$baseline_file"
  echo "✅ '$metric' baseline updated: $current ($label)"
  exit 0
fi

if [ ! -f "$baseline_file" ]; then
  echo "❌ missing baseline: $baseline_file (run: scripts/ratchet.sh $metric --update)" >&2
  exit 2
fi

baseline="$(tr -d '[:space:]' < "$baseline_file")"

if [ "$current" -gt "$baseline" ]; then
  echo "❌ '$metric' ratchet: $current > baseline $baseline — regression not allowed."
  echo "   ($label)"
  echo "   → $hint"
  exit 1
fi

if [ "$current" -lt "$baseline" ]; then
  echo "🎉 Progress on '$metric': $current < baseline $baseline."
  echo "   Update the baseline in the same PR: npm run ratchet:$metric -- --update"
  echo "   then commit $baseline_file."
  exit 1
fi

echo "✅ '$metric' ratchet: $current (= baseline $baseline)."
