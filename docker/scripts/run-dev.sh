#!/bin/sh

set -e

if [ -n "$WITHOUT_KUZZLE" ]; then
  exit 0
fi

if [ -z "$NODE_VERSION" ];
then
  echo "Missing NODE_VERSION, use default $NODE_18_VERSION"
  n $NODE_18_VERSION
fi

if [ -n "$TRAVIS" ] || [ -n "$REBUILD" ]; then
    npm ci --unsafe-perm
    chmod -R 777 node_modules/
    npm rebuild all --unsafe-perm
elif [ ! -d "./node_modules/" ]; then
    git submodule update --init --recursive
    npm ci --unsafe-perm
fi

echo "[$(date)] - Starting Kuzzle..."

npx ergol docker/scripts/start-kuzzle-dev.ts \
  -c ./config/ergol.config.json
