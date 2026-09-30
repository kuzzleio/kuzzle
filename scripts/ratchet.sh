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
#   scripts/ratchet.sh <js|any|casts|cpd-exclusions> [--update]
#   npm run ratchet                  # all four, check mode
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
  any)
    # 'as unknown as' is counted too: it is the escape hatch a conversion reaches
    # for once ': any' is forbidden, so leaving it out would just move the debt.
    #
    # There used to be a sibling 'implicit-any' ratchet counting the TS7xxx
    # diagnostics tsc reports under a `noImplicitAny`-only program. It retired with
    # the strict flip (step 12, K6): `strict` in tsconfig.json subsumes
    # `noImplicitAny`, and the build itself now fails on an inferred any in lib/,
    # which is a harder floor than a count that may only decrease.
    label="': any' / 'as any' / 'as unknown as' lines in lib/**/*.ts"
    baseline_file=".migration/any-baseline.txt"
    current="$(grep -rE ': any|as any|as unknown as' lib --include='*.ts' 2>/dev/null | wc -l | tr -d ' ')"
    hint="Type explicitly instead of 'any' (prefer 'unknown' + narrowing if dynamic)."
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
    # Fail CLOSED: `tail -n 1` of a crashed script is a stack trace line, not a
    # count, and a ratchet that reads it as 0 reports "below baseline" — i.e. it
    # tells the caller to disarm itself. The counter must exit 0 AND its last line
    # must be a number. Same defect class as TD-44 (#2731), and as the `npx tsc`
    # that prints "This is not the tsc command you are looking for" and exits 0
    # (#2793), which is what this guard actually caught.
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
    echo "usage: scripts/ratchet.sh <js|any|casts|cpd-exclusions> [--update]" >&2
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
