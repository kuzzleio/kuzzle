#!/bin/sh

set -ex

if [ -z "$NODE_VERSION" ];
then
  echo "Missing NODE_VERSION, use default NODE_12_VERSION"
  NODE_VERSION=$NODE_12_VERSION
fi

echo "Testing Kuzzle against node v$NODE_VERSION"

export NVM_DIR="$HOME/.nvm"
. "$NVM_DIR/nvm.sh"
nvm use $NODE_VERSION

npm run build

node -r ts-node/register features-sdk/application/functional-tests-app.ts &

echo "[$(date)] - Starting Kuzzle..."

./bin/wait-kuzzle

npm run $KUZZLE_FUNCTIONAL_TESTS
