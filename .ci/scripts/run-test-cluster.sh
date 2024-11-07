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
docker compose -f $YML_FILE run --rm kuzzle_node_1 npm ci

if [ "$REBUILD" == "true" ];
then
  docker compose -f $YML_FILE run --rm kuzzle_node_1 npm rebuild
fi

docker compose -f $YML_FILE run --rm kuzzle_node_1 npm run build

echo "[$(date)] - Starting Kuzzle Cluster..."

trap 'docker compose -f $YML_FILE logs' err

docker compose -f $YML_FILE up -d

KUZZLE_PORT=17510 ./bin/wait-kuzzle
KUZZLE_PORT=17511 ./bin/wait-kuzzle
KUZZLE_PORT=17512 ./bin/wait-kuzzle
KUZZLE_PORT=7512 ./bin/wait-kuzzle

trap - err

npm run $KUZZLE_FUNCTIONAL_TESTS