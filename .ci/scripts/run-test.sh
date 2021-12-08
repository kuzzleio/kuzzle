#!/bin/sh

set -ex

if [ -z "$NODE_VERSION" ];
then
  echo "Missing NODE_VERSION, use default NODE_14_VERSION"
  NODE_VERSION=$NODE_14_VERSION
fi

echo "Testing Kuzzle against node v$NODE_VERSION"
n $NODE_VERSION

npm install --silent --unsafe-perm

npm run build

npm pack

tar xf kuzzle-*.tgz

echo "[$(date)] - Starting Kuzzle..."

# Use the built package for functional tests
sed -i 's/require("..\/..\/index")/require("..\/..\/package\/index")/g' docker/scripts/start-kuzzle-dev.js

node -r ts-node/register docker/scripts/start-kuzzle-dev.js --enable-plugins functional-test-plugin &

./bin/wait-kuzzle

npm run $KUZZLE_FUNCTIONAL_TESTS
