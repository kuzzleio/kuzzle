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
#   scripts/ratchet.sh <js|mocha|any|implicit-any|cpd-exclusions> [--update]
#   npm run ratchet                  # all five, check mode
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
    current="$(npx tsc -p tsconfig.implicit.json --noEmit 2>&1 | grep -cE 'error TS7[0-9]{3}' || true)"
    hint="Annotate the parameter/variable instead of letting it infer to any."
    ;;
  *)
    echo "usage: scripts/ratchet.sh <js|mocha|any|implicit-any|cpd-exclusions> [--update]" >&2
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
