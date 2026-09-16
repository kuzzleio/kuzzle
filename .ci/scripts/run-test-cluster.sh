#!/bin/bash

set -ex

if [ -z "$NODE_VERSION" ];
then
  echo "Missing NODE_VERSION, use default NODE_20_VERSION"
  export NODE_VERSION=$NODE_20_VERSION
fi

echo "Testing Kuzzle against node v$NODE_VERSION"

if [ "$ES_VERSION" == "7" ]; then
    YML_FILE='./.ci/test-cluster-7.yml'
elif [ "$ES_VERSION" == "8" ]; then
    YML_FILE='./.ci/test-cluster-8.yml'
else
    echo "Invalid ES_VERSION. It should be either '7' or '8'."
    exit 1 
fi

docker compose -f $YML_FILE down -v

echo "Installing dependencies..."
docker compose -f $YML_FILE run --rm --no-deps kuzzle_node_1 npm ci

echo "[$(date)] - Starting Kuzzle Cluster..."

# shellcheck source=./dump-cluster-logs.sh
source "$(dirname "${BASH_SOURCE[0]}")/dump-cluster-logs.sh"

trap dump_cluster_logs err

docker compose -f $YML_FILE up -d

KUZZLE_PORT=17510 ./bin/wait-kuzzle
KUZZLE_PORT=17511 ./bin/wait-kuzzle
KUZZLE_PORT=17512 ./bin/wait-kuzzle
# The production-mode node: features/StackTrace.feature addresses it directly,
# and nginx does not balance over it, so nothing else would wait for it.
KUZZLE_PORT=17513 ./bin/wait-kuzzle
KUZZLE_PORT=7512 ./bin/wait-kuzzle

# The trap stays on for the suite. It used to be cleared here, so the one class
# of failure where the cluster's own view matters most — a scenario failing
# because state did not propagate between nodes (TD-33, #2715) — dumped nothing.
# That is how the 2026-09-16 `legacy:http, 24, 8` failure was lost: 74 scenarios,
# one red step on `services.storage.unknown_collection`, and no node logs.
npm run $KUZZLE_FUNCTIONAL_TESTS

trap - err