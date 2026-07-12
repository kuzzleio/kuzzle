#!/usr/bin/env bash
#
# TypeScript-migration ratchets — see adrs/ADR-0001-migration-typescript.md (§6.1, §6.2, §6.3).
#
# A tracked metric may only DECREASE. The baseline file (.migration/*-baseline.txt)
# records the EXACT current value; every migration PR that improves a metric must
# update its baseline in the same PR (part of the PR's definition of done). CI runs
# these in "check" mode and fails on any regression (and, deliberately, on an
# unrecorded improvement — so the baseline always mirrors reality).
#
# Usage:
#   scripts/ratchet.sh <js|mocha|any> [--update]
#   npm run ratchet                  # all three, check mode
#   npm run ratchet:js -- --update   # record the current js count as the new baseline
#
set -euo pipefail

cd "$(dirname "$0")/.."

metric="${1:-}"
mode="${2:-check}"

case "$metric" in
  js)
    label=".js files under lib/ and bin/"
    baseline_file=".migration/js-baseline.txt"
    current="$(find lib bin -type f -name '*.js' ! -name '*.d.ts' | wc -l | tr -d ' ')"
    hint="Write new code in .ts — no new .js under lib/ or bin/."
    ;;
  mocha)
    label="Mocha specs (test/**/*.test.js)"
    baseline_file=".migration/mocha-baseline.txt"
    current="$(find test -type f -name '*.test.js' | wc -l | tr -d ' ')"
    hint="Write new unit tests in vitest + TS (ADR §6.3)."
    ;;
  any)
    label="': any' / 'as any' lines in lib/**/*.ts"
    baseline_file=".migration/any-baseline.txt"
    current="$(grep -rE ': any|as any' lib --include='*.ts' 2>/dev/null | wc -l | tr -d ' ')"
    hint="Type explicitly instead of 'any' (prefer 'unknown' + narrowing if dynamic)."
    ;;
  *)
    echo "usage: scripts/ratchet.sh <js|mocha|any> [--update]" >&2
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
