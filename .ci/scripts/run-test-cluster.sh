#!/bin/bash

set -ex


if [ -z "$NODE_VERSION" ];
then
  echo "Missing NODE_VERSION, use default NODE_20_VERSION"
  export NODE_VERSION=$NODE_20_VERSION
fi

docker compose -f ./.ci/test-cluster.yml down -v

echo "Testing Kuzzle against node v$NODE_VERSION"

echo "Installing dependencies..."
docker compose -f ./.ci/test-cluster.yml run --rm kuzzle_node_1 npm ci

if [ "$REBUILD" == "true" ];
then
  docker compose -f ./.ci/test-cluster.yml run --rm kuzzle_node_1 npm rebuild
fi

docker compose -f ./.ci/test-cluster.yml run --rm kuzzle_node_1 npm run build

echo "[$(date)] - Starting Kuzzle Cluster..."

trap 'docker compose -f ./.ci/test-cluster.yml logs' err

docker compose -f ./.ci/test-cluster.yml up -d

# don't wait on 7512: nginx will accept connections far before Kuzzle does
KUZZLE_PORT=17510 ./bin/wait-kuzzle
KUZZLE_PORT=17511 ./bin/wait-kuzzle
KUZZLE_PORT=17512 ./bin/wait-kuzzle

trap - err

npm run $KUZZLE_FUNCTIONAL_TESTS
