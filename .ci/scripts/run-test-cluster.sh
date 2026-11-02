#!/bin/bash

set -ex

if [ -z "$NODE_VERSION" ];
then
  echo "Missing NODE_VERSION, use default 24 (the CI test-cluster image default)"
  export NODE_VERSION=24
fi

# Resolved absolutely, once, so it does not depend on the caller's cwd.
WITH_RETRY="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/with-retry.sh"

# `bin/wait-kuzzle.ts` is TypeScript and not part of the published build, so it
# runs through `ts-node` — the same idiom as `.ci/test-cluster-*.yml` for
# `start-kuzzle-test.ts`. See docs/adr-001/steps/03-sprint-2-bin.md.
WAIT_KUZZLE=(node -r ts-node/register/transpile-only ./bin/wait-kuzzle.ts)

echo "Testing Kuzzle against node v$NODE_VERSION"

if [ "$ES_VERSION" == "7" ]; then
    YML_FILE='./.ci/test-cluster-7.yml'
elif [ "$ES_VERSION" == "8" ]; then
    YML_FILE='./.ci/test-cluster-8.yml'
else
    echo "Invalid ES_VERSION. It should be either '7' or '8'."
    exit 1 
fi

COMPOSE=(docker compose -f "$YML_FILE")

# STORAGE_DRIVER=core-only: every node runs a storage driver declaring no
# optional capability (ADR-0003 step 04), and the suite skips the scenarios
# tagged `@capability-<name>` (cucumber.config.cjs, run from here).
# STORAGE_DRIVER=es9|opensearch2|opensearch3: Elasticsearch 9 or OpenSearch,
# and its external driver (ADR-0003 steps 05 and 07), staged from npm at the
# version .ci/scripts/stage-storage-driver.sh pins (STORAGE_DRIVER_SPEC:
# another npm spec; ES9_DRIVER is still read for es9) and mounted by an
# overlay of the ES 8 cluster file.
case "${STORAGE_DRIVER:-}" in
  "") ;;
  core-only)
    COMPOSE+=(-f ./.ci/test-cluster-core-only-driver.yml)
    export KUZZLE_STORAGE_CAPABILITIES=""
    ;;
  es9|opensearch2|opensearch3)
    if [ "$ES_VERSION" != "8" ]; then
      echo "STORAGE_DRIVER=$STORAGE_DRIVER runs on top of the ES 8 cluster file: set ES_VERSION=8"
      exit 1
    fi

    COMPOSE+=(-f "./.ci/test-cluster-$STORAGE_DRIVER-driver.yml")
    SPEC="${STORAGE_DRIVER_SPEC:-}"
    if [ -z "$SPEC" ] && [ "$STORAGE_DRIVER" == "es9" ]; then
      SPEC="${ES9_DRIVER:-}"
    fi
    "$WITH_RETRY" ./.ci/scripts/stage-storage-driver.sh "$STORAGE_DRIVER" ${SPEC:+"$SPEC"}
    ;;
  *)
    echo "Invalid STORAGE_DRIVER '$STORAGE_DRIVER' (expected core-only, es9, opensearch2 or opensearch3)"
    exit 1
    ;;
esac

"${COMPOSE[@]}" down -v

echo "Installing dependencies..."
# NPM_CACHE_DIR (CI sets it to the runner's ~/.npm, which setup-node restores
# from the lockfile-keyed cache) is mounted as the container's npm cache, so
# the install reads tarballs from disk instead of the registry.
NPM_CACHE_MOUNT=()
if [ -n "${NPM_CACHE_DIR:-}" ]; then
  mkdir -p "$NPM_CACHE_DIR"
  NPM_CACHE_MOUNT=(-v "$NPM_CACHE_DIR:/var/npm")
fi

# Retried: the install still has network dependencies (re2 downloads its
# binary at install time). See .ci/scripts/with-retry.sh (TD-83).
"$WITH_RETRY" \
  "${COMPOSE[@]}" run --rm --no-deps "${NPM_CACHE_MOUNT[@]}" kuzzle_node_1 npm ci --prefer-offline

echo "[$(date)] - Starting Kuzzle Cluster..."

# shellcheck source=./dump-cluster-logs.sh
source "$(dirname "${BASH_SOURCE[0]}")/dump-cluster-logs.sh"

trap dump_cluster_logs err

"${COMPOSE[@]}" up -d

KUZZLE_PORT=17510 "${WAIT_KUZZLE[@]}"
KUZZLE_PORT=17511 "${WAIT_KUZZLE[@]}"
KUZZLE_PORT=17512 "${WAIT_KUZZLE[@]}"
# The production-mode node: features/StackTrace.feature addresses it directly,
# and nginx does not balance over it, so nothing else would wait for it.
KUZZLE_PORT=17513 "${WAIT_KUZZLE[@]}"
KUZZLE_PORT=7512 "${WAIT_KUZZLE[@]}"

# The trap stays on for the suite. It used to be cleared here, so the one class
# of failure where the cluster's own view matters most — a scenario failing
# because state did not propagate between nodes (TD-33, #2715) — dumped nothing.
# That is how the 2026-09-16 `legacy:http, 24, 8` failure was lost: 74 scenarios,
# one red step on `services.storage.unknown_collection`, and no node logs.
npm run $KUZZLE_FUNCTIONAL_TESTS

trap - err

# Dumped on success too: the only record of what the cluster did during a green
# run, and what `check_cluster_logs` failed on when it fails.
dump_cluster_logs
check_cluster_logs