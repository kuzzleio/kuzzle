#!/bin/sh

set -e

if [ -n "$WITHOUT_KUZZLE" ]; then
  exit 0
fi

if [ -z "$NODE_VERSION" ];
then
  echo "Missing NODE_VERSION, use default $NODE_14_VERSION"
  n $NODE_14_VERSION
fi

if [ -n "$TRAVIS" ] || [ -n "$REBUILD" ]; then
    # npm ci --unsafe-perm
    chmod -R 777 node_modules/
    npm rebuild all --unsafe-perm
elif [ ! -d "./node_modules/" ]; then
    git submodule update --init --recursive
    npm ci --unsafe-perm
fi

echo "[$(date)] - Starting Kuzzle..."

if [ -n "$KUZZLE_PLUGINS" ];
then
  ENABLED_PLUGINS="$KUZZLE_PLUGINS,functional-test-plugin"
else
  ENABLED_PLUGINS=functional-test-plugin
fi

npx ergol docker/scripts/start-kuzzle-dev.ts \
  -c ./config/ergol.config.json \
  --script-args=--mappings /fixtures/mappings.json \
  --script-args=--fixtures /fixtures/fixtures.json \
  --script-args=--securities /fixtures/securities.json \
  --script-args=--enable-plugins $ENABLED_PLUGINS
