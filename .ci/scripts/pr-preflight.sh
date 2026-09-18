#!/usr/bin/env bash
#
# Run the local checks most likely to fail in CI before pushing:
#   - lint (matches the `lint` job in pull_request.workflow.yaml)
#   - error codes documentation (matches the `error-codes-check` job)
#   - the migration ratchets + strict (matches the `migration-ratchets` job)
#   - a reminder to adopt a converted file into strict once it is clean
#   - a reminder to report the strict count a conversion leaves behind
#   - a heuristic reminder about test/doc coverage (CONTRIBUTING.md)
#
# Requires local Node.js/npm (same as `npm run test:lint` would).
#
set -uo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

status=0

echo "==> Lint (npm run test:lint)"
if npm run test:lint; then
  echo "[OK] lint"
else
  echo "[FAIL] lint"
  status=1
fi

echo
echo "==> Error codes documentation"
tmp_codes_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_codes_dir"' EXIT

if npm run doc-error-codes -- --output "$tmp_codes_dir" > /dev/null; then
  mismatch=0
  for domain_dir in doc/2/api/errors/error-codes/*/; do
    [ -d "$domain_dir" ] || continue
    domain="$(basename "$domain_dir")"
    if ! diff -q "$domain_dir" "$tmp_codes_dir/$domain" > /dev/null 2>&1; then
      echo "[FAIL] error codes docs out of date for domain '$domain' — run: npm run doc-error-codes"
      mismatch=1
    fi
  done
  if [ "$mismatch" -eq 0 ]; then
    echo "[OK] error codes docs"
  else
    status=1
  fi
else
  echo "[FAIL] npm run doc-error-codes failed to generate docs"
  status=1
fi

echo
echo "==> Migration ratchets & strict (npm run ratchet, npm run test:strict)"
# The E1 gotcha: a conversion that leaves the .js tracked passes locally but
# fails the js ratchet in CI. Cheap to catch here.
if npm run ratchet && npm run test:strict; then
  echo "[OK] ratchets & strict"
else
  echo "[FAIL] ratchets & strict"
  status=1
fi

echo
echo "==> Test & doc coverage reminder (heuristic, not a hard gate)"
# The base is `2-dev`, not `master`: the migration lands there, and master is
# hundreds of commits behind it. Diffing against master made both reminders
# below read ~330 changed files on every branch, which is the same as no
# reminder at all. PREFLIGHT_BASE overrides it for a branch based elsewhere.
base_branch="${PREFLIGHT_BASE:-2-dev}"
base_ref=""
for ref in "origin/$base_branch" "$base_branch" origin/master master; do
  base_ref="$(git merge-base HEAD "$ref" 2>/dev/null || true)"
  [ -n "$base_ref" ] && break
done
if [ -n "$base_ref" ]; then
  changed="$(git diff --name-only "$base_ref"...HEAD; git diff --name-only; git diff --name-only --cached)"
else
  changed="$(git diff --name-only; git diff --name-only --cached)"
fi
changed="$(echo "$changed" | sort -u)"

lib_changed="$(echo "$changed" | grep -E '^lib/' || true)"
test_changed="$(echo "$changed" | grep -E '^(test|tests|features|features-legacy)/' || true)"

if [ -n "$lib_changed" ] && [ -z "$test_changed" ]; then
  echo "[WARN] lib/ changed with no test/tests/features file changed — CONTRIBUTING.md:"
  echo "       \"Always add/update the corresponding unit and/or functional tests.\""
  echo "$lib_changed" | sed 's/^/    /'
elif [ -n "$lib_changed" ]; then
  echo "[OK] lib/ changes have matching test/feature changes"
else
  echo "[OK] no lib/ changes"
fi


echo
echo "==> Strict adoption reminder (ADR-0001: adopt a converted file once it is clean)"
candidates="$(bash scripts/strict-check.sh --candidates 2>/dev/null | grep -vE '^#' || true)"
unadopted=""
for f in $(echo "$changed" | grep -E '^lib/.*\.ts$' || true); do
  if echo "$candidates" | grep -qxF "$f"; then
    unadopted="$unadopted$f"$'\n'
  fi
done
if [ -n "$unadopted" ]; then
  echo "[WARN] these changed files pass strict but are not in .migration/strict-adopted.txt:"
  printf '%s' "$unadopted" | sed 's/^/    /'
  echo "       Add them there in this PR so the ratchet guards them from now on."
else
  echo "[OK] no changed file is strict-clean-but-unadopted"
fi

echo "==> Strict-count reminder for conversions (ADR-0001: a conversion reports the count it leaves behind)"
# A conversion shows up as a rename: lib/x.js -> lib/x.ts. If the result is not
# adopted into strict, the PR owes a per-file error count and a reading of it —
# which errors are guards the runtime can reach (bugs) rather than types it
# already guarantees. Sprints 6 and 7 left 246 unreported (TD-54, #2757).
# Read from the same three sources as the coverage reminder above, plus
# untracked files: a conversion is usually checked BEFORE it is committed, and
# `"$base_ref"...HEAD` sees committed history only. Run on sprint 8 J1's two
# conversions before committing them, this printed "no .js -> .ts conversion in
# this branch"; committing the same tree made it print both. See TD-66 (#2774).
#
# Untracked matters on top of TD-66's three: a freshly written `x.ts` that has
# not been `git add`ed appears in no `git diff` at all, which is exactly the
# state a conversion is in when its author runs preflight.
#
# Two spellings of the same event: a rename git detected, and an add of x.ts
# next to a delete of x.js that it did not (a conversion that rewrites enough
# of the file falls under the similarity threshold).
collect_conversions() {
  # $@ : the `git diff` range arguments (none = working tree)
  git diff --find-renames --diff-filter=R --name-status "$@" 2>/dev/null \
    | awk -F'\t' '$2 ~ /\.js$/ && $3 ~ /^(lib|index)/ && $3 ~ /\.ts$/ { print $3 }'
  git diff --no-renames --name-status "$@" 2>/dev/null \
    | awk -F'\t' '$1 == "A" && $2 ~ /^(lib|index)/ && $2 ~ /\.ts$/ { added[$2] = 1 }
                  $1 == "D" && $2 ~ /\.js$/ { sub(/\.js$/, ".ts", $2); deleted[$2] = 1 }
                  END { for (f in added) if (f in deleted) print f }'
}

converted="$( {
  if [ -n "$base_ref" ]; then
    collect_conversions "$base_ref"...HEAD
  fi
  collect_conversions
  collect_conversions --cached

  # An untracked x.ts whose x.js sibling is gone from disk but exists in HEAD.
  # Tested against HEAD rather than the index on purpose: the delete may be
  # unstaged, staged (`git rm`) or already committed, and only HEAD is true in
  # all three.
  git ls-files --others --exclude-standard 2>/dev/null \
    | grep -E '^(lib|index).*\.ts$' \
    | while read -r ts; do
        js="${ts%.ts}.js"

        if ! [ -e "$js" ] && git cat-file -e "HEAD:$js" > /dev/null 2>&1; then
          printf '%s\n' "$ts"
        fi
      done
} | sort -u || true)"

adopted_list="$(grep -vE '^[[:space:]]*(#|$)' .migration/strict-adopted.txt 2>/dev/null || true)"
unreported=""
for f in $converted; do
  printf '%s\n' "$adopted_list" | grep -qxF "$f" || unreported="$unreported$f"$'\n'
done

if [ -z "$converted" ]; then
  echo "[OK] no .js -> .ts conversion in this branch"
elif [ -z "$unreported" ]; then
  echo "[OK] every file converted here is in .migration/strict-adopted.txt"
else
  echo "[WARN] converted but not adopted into strict — report these counts in the PR body:"
  # shellcheck disable=SC2086
  bash scripts/strict-check.sh --count $(printf '%s' "$unreported") 2>/dev/null | sed 's/^/    /'
  echo "       For each file, say which of those errors are guards the runtime can"
  echo "       reach — those are bugs, not typing chores. A conversion that compiles"
  echo "       is not a conversion that checks. (ADR-0001, TD-54)"
fi

echo
if [ "$status" -eq 0 ]; then
  echo "Preflight passed."
else
  echo "Preflight FAILED — fix the issues above before pushing."
fi

exit "$status"
