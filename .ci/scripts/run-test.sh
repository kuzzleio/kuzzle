#!/bin/sh

set -ex

NODE_VERSION=$NODE_12_VERSION

echo "Testing Kuzzle against node v$NODE_VERSION"
n $NODE_VERSION

npm install --silent --unsafe-perm

./docker/scripts/install-plugins.sh

echo "[$(date)] - Starting Kuzzle..."

node bin/start-kuzzle-server --enable-plugins functional-test-plugin &

./bin/wait-kuzzle

npm run $KUZZLE_FUNCTIONAL_TESTS
