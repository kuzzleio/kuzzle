#!/bin/sh

set -e

if [ ! -z "$WITHOUT_KUZZLE" ]; then
  exit 0
fi

if [ ! -z "$TRAVIS" ] || [ ! -z "$REBUILD" ]; then
    npm ci --unsafe-perm
    chmod -R 777 node_modules/
    npm rebuild all --unsafe-perm
    docker-compose/scripts/install-plugins.sh
elif [ ! -d "./node_modules/" ]; then
    git submodule update --init --recursive
    npm ci --unsafe-perm
    ./docker-compose/scripts/install-plugins.sh
fi

echo "[$(date)] - Starting Kuzzle..."

nodemon \
    --inspect=0.0.0.0:9229 \
    bin/start-kuzzle-server \
    --mappings /fixtures/mappings.json \
    --fixtures /fixtures/fixtures.json \
    --securities /fixtures/securities.json \
    --enable-plugins functional-test-plugin \
