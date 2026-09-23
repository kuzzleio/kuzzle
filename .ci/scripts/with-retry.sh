#!/bin/bash

# Retry a command that only ever fails for network reasons.
#
# `npm ci` builds native addons here (boost-geospatial-index, dumpme, re2,
# zeromq), and node-gyp downloads the Node headers for the running version
# from nodejs.org before it can configure any of them. That download is the
# one network dependency of the install npm's own retry settings do NOT cover:
# `fetch-retries` governs the registry client, and node-gyp's downloader is a
# separate one that does not retry.
#
# It took out #2838 and #2846 (step 13's L4d4 and L4e7) in two days, both on
# the `npm ci` that runs INSIDE the test-cluster container, in two shapes:
# #2846 failed the fetch (`attempt 1 failed with ECONNRESET`, install rolled
# back), and #2838 half-succeeded — truncated headers unpacked into the cache,
# then `unterminated #ifdef` in v8config.h and a C++ syntax error in a repo
# that has no C++. Re-running the same commit was green both times.
#
# So: retry the whole command. `npm ci` removes node_modules before doing
# anything else, and each containerised attempt gets a fresh `--rm` container,
# so neither a rolled-back install nor a poisoned header cache survives into
# the retry. See docs/adr-001/type-debt-register.md, TD-83.

set -uo pipefail

ATTEMPTS="${RETRY_ATTEMPTS:-3}"
DELAY="${RETRY_DELAY:-10}"

if [ "$#" -eq 0 ]; then
  echo "usage: with-retry.sh <command> [args...]" >&2
  exit 64
fi

for attempt in $(seq 1 "$ATTEMPTS"); do
  echo "[with-retry] attempt ${attempt}/${ATTEMPTS}: $*"

  # Not `if "$@"; then ... fi`: an `if` whose branch is not taken returns 0,
  # so `$?` after it is the *if statement's* status, not the command's.
  "$@" && exit 0
  status=$?

  if [ "$attempt" -eq "$ATTEMPTS" ]; then
    echo "[with-retry] '$*' failed ${ATTEMPTS} times, giving up (exit ${status})" >&2
    exit "$status"
  fi

  echo "[with-retry] '$*' failed (exit ${status}), retrying in ${DELAY}s" >&2
  sleep "$DELAY"
  DELAY=$((DELAY * 2))
done
