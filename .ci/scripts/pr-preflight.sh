#!/usr/bin/env bash
#
# Run the local checks most likely to fail in CI before pushing:
#   - lint (matches the `lint` job in pull_request.workflow.yaml)
#   - error codes documentation (matches the `error-codes-check` job)
#   - the migration ratchets + strict (matches the `migration-ratchets` job)
#   - a reminder to adopt a converted file into strict once it is clean
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
base_ref="$(git merge-base HEAD origin/master 2>/dev/null || git merge-base HEAD master 2>/dev/null || true)"
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
echo
if [ "$status" -eq 0 ]; then
  echo "Preflight passed."
else
  echo "Preflight FAILED — fix the issues above before pushing."
fi

exit "$status"
