#!/usr/bin/env bash
#
# Run the local checks most likely to fail in CI before pushing:
#   - lint (matches the `lint` job in pull_request.workflow.yaml)
#   - error codes documentation (matches the `error-codes-check` job)
#   - the migration ratchets + the test type-check (matches `migration-ratchets`)
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
echo "==> Migration ratchets & test type-check (npm run ratchet, npm run typecheck:tests)"
# The E1 gotcha: a conversion that leaves the .js tracked passes locally but
# fails the js ratchet in CI. Cheap to catch here.
#
# There is no strict step any more: `strict` is on in tsconfig.json since step 12
# (K6), so production code that does not pass it does not build. What needs its
# own check is the test program, which the build no longer compiles.
if npm run ratchet && npm run typecheck:tests; then
  echo "[OK] ratchets & test type-check"
else
  echo "[FAIL] ratchets & test type-check"
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
if [ "$status" -eq 0 ]; then
  echo "Preflight passed."
else
  echo "Preflight FAILED — fix the issues above before pushing."
fi

exit "$status"
