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


nodemon \
    --ext 'js,json,ts' \
    --inspect=0.0.0.0:9229 \
    --exec node -r ts-node/register \
    bin/start-kuzzle-server \
    --mappings /fixtures/mappings.json \
    --fixtures /fixtures/fixtures.json \
    --securities /fixtures/securities.json \
    --enable-plugins $ENABLED_PLUGINS
