#!/bin/sh

set -ex

if [ -z "$NODE_VERSION" ];
then
  echo "Missing NODE_VERSION, use default NODE_14_VERSION"
  NODE_VERSION=$NODE_14_VERSION
fi

echo "Testing Kuzzle against node v$NODE_VERSION"

export NVM_DIR="$HOME/.nvm"
. "$NVM_DIR/nvm.sh"
nvm use $NODE_VERSION

npm run build

node -r ts-node/register docker/scripts/start-kuzzle-dev.ts &

echo "[$(date)] - Starting Kuzzle..."

./bin/wait-kuzzle

npm run $KUZZLE_FUNCTIONAL_TESTS
