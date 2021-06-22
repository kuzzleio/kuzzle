#!/bin/sh

set -e

if [ -n "$WITHOUT_KUZZLE" ]; then
  exit 0
fi

if [ -n "$TRAVIS" ] || [ -n "$REBUILD" ]; then
    npm ci --unsafe-perm
    chmod -R 777 node_modules/
    npm rebuild all --unsafe-perm
    ./docker/scripts/install-plugins.sh
elif [ ! -d "./node_modules/" ]; then
    git submodule update --init --recursive
    npm ci --unsafe-perm
    ./docker/scripts/install-plugins.sh
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
