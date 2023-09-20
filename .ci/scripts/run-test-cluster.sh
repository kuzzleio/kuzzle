#!/bin/bash

set -ex


if [ -z "$NODE_VERSION" ];
then
  echo "Missing NODE_VERSION, use default NODE_18_VERSION"
  export NODE_VERSION=$NODE_18_VERSION
fi

echo "Testing Kuzzle against node v$NODE_VERSION"

echo "Installing dependencies..."
npm install

if [ "$REBUILD" == "true" ];
then
  docker-compose -f ./.ci/test-cluster.yml run kuzzle_node_1 npm rebuild
fi

npm run build-ts

echo "[$(date)] - Starting Kuzzle Cluster..."

trap 'docker-compose -f ./.ci/test-cluster.yml logs' err

docker-compose -f ./.ci/test-cluster.yml up -d

# don't wait on 7512: nginx will accept connections far before Kuzzle does
KUZZLE_PORT=17510 ./bin/wait-kuzzle
KUZZLE_PORT=17511 ./bin/wait-kuzzle
KUZZLE_PORT=17512 ./bin/wait-kuzzle

trap - err

npm run $KUZZLE_FUNCTIONAL_TESTS
