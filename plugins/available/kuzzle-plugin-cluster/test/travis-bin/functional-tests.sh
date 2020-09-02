#!/bin/bash

set -e

docker pull kuzzleio/kuzzle

cd "$TRAVIS_BUILD_DIR"
touch docker-compose/my.env

./dev-npm-install.sh

./dev.sh > /dev/null 2>&1 &

echo "waiting for kuzzle"
timeout 60 bash -c 'until curl -f -s -o /dev/null http://localhost:7512/_plugin/cluster/health; do echo -n ".";sleep 1; done'

docker-compose -p cluster \
  -f docker-compose/docker-compose.yml \
  exec kuzzle ./node_modules/.bin/cucumber-js -b --format progress-bar -p websocketCluster

