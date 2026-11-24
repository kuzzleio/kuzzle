#!/usr/bin/env bash
#
# Decides what the `Tests` workflow (.github/workflows/pull_request.workflow.yaml)
# runs, and writes it to $GITHUB_OUTPUT (stdout when unset, for a local check):
#
#   code=true|false  false: the pull request or push only edits documentation
#                    (docs/, doc/, Markdown files): the test jobs are skipped.
#   full=true|false  the full test matrix, or the reduced one.
#   functional, drivers, core-only, monkey
#                    the matrices of the cluster jobs, as {"include": [...]}.
#
# The full matrix runs on every push to 2-dev (each merge), on a manual run
# ("Run workflow", any branch), and on pull requests to beta and master (the
# release PRs). Pull requests to 2-dev run the reduced matrix: every test set,
# Node.js major, Elasticsearch major and storage driver at least once, not
# every combination (13 cluster jobs instead of 43). A combination that only
# the full matrix covers fails on 2-dev after the merge, not on the PR.
#
# Inputs (environment): EVENT_NAME, BASE_REF (pull request), BASE_SHA and
# HEAD_SHA (the range to diff; none on a manual run).

set -euo pipefail

out="${GITHUB_OUTPUT:-/dev/stdout}"

code=true
# No range on a manual run, an all-zero base when a push creates the branch:
# both count as code, and so does an empty or unreadable diff.
if [ -n "${BASE_SHA:-}" ] && [ -n "${HEAD_SHA:-}" ] && [ "${BASE_SHA//0/}" != "" ]; then
  changed="$(git diff --name-only "$BASE_SHA...$HEAD_SHA" || true)"
  printf 'Changed files:\n%s\n' "$changed"

  if ! printf '%s\n' "$changed" | grep -qvE '^(docs|doc)/|\.md$'; then
    echo "Documentation only: the test jobs are skipped."
    code=false
  fi
fi

full=true
if [ "${EVENT_NAME:-}" == "pull_request" ] && [ "${BASE_REF:-}" != "beta" ] && [ "${BASE_REF:-}" != "master" ]; then
  full=false
fi

test_sets='["http","websocket","legacy:mqtt","legacy:http","legacy:websocket"]'

if [ "$full" == "true" ]; then
  echo "Full test matrix."

  functional="$(jq -cn --argjson sets "$test_sets" \
    '{include: [$sets[] as $s | (22, 24) as $n | (7, 8) as $e | {"test-set": $s, "node-version": $n, "es-version": $e}]}')"
  drivers="$(jq -cn --argjson sets "$test_sets" \
    '{include: [("es9", "opensearch2", "opensearch3") as $d | $sets[] as $s | {driver: $d, "test-set": $s}]}')"
  core_only='{"include":[{"test-set":"http"},{"test-set":"websocket"}]}'
  monkey='{"include":[{"node-version":22,"es-version":7},{"node-version":22,"es-version":8},{"node-version":24,"es-version":7},{"node-version":24,"es-version":8}]}'
else
  echo "Reduced test matrix (full on 2-dev after the merge, or with a manual run)."

  # Each test set once; each (Node.js, Elasticsearch) pair at least once.
  functional='{"include":[
    {"test-set":"http","node-version":24,"es-version":8},
    {"test-set":"websocket","node-version":22,"es-version":7},
    {"test-set":"legacy:http","node-version":22,"es-version":8},
    {"test-set":"legacy:websocket","node-version":24,"es-version":7},
    {"test-set":"legacy:mqtt","node-version":24,"es-version":8}]}'
  # Each external driver once, on a current protocol.
  drivers='{"include":[
    {"driver":"es9","test-set":"websocket"},
    {"driver":"opensearch2","test-set":"http"},
    {"driver":"opensearch3","test-set":"websocket"}]}'
  core_only='{"include":[{"test-set":"websocket"}]}'
  # Each Node.js and Elasticsearch major once.
  monkey='{"include":[{"node-version":22,"es-version":7},{"node-version":24,"es-version":8}]}'
fi

{
  echo "code=$code"
  echo "full=$full"
  echo "functional=$(jq -c . <<< "$functional")"
  echo "drivers=$(jq -c . <<< "$drivers")"
  echo "core-only=$(jq -c . <<< "$core_only")"
  echo "monkey=$(jq -c . <<< "$monkey")"
} >> "$out"
