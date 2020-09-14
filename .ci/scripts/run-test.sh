#!/bin/sh

set -ex

if [ -z "$NODE_VERSION" ];
then
  echo "Missing NODE_VERSION, use default NODE_12_VERSION"
  NODE_VERSION=$NODE_12_VERSION
fi

echo "Testing Kuzzle against node v$NODE_VERSION"
n $NODE_VERSION

npm install --silent --unsafe-perm

npm run build

./docker/scripts/install-plugins.sh

echo "[$(date)] - Starting Kuzzle..."

node -r ts-node/register docker/scripts/start-kuzzle-dev.ts &

./bin/wait-kuzzle

npm run $KUZZLE_FUNCTIONAL_TESTS
