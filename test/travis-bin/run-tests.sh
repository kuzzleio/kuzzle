#!/bin/bash

set -e

sudo sysctl -w vm.max_map_count=262144

if [ "${TRAVIS_BRANCH}" != "master" ]; then
  export DOCKER_PROXY_TAG=":develop"
fi

docker-compose -f docker-compose/test.yml run kuzzle

NODE_MAJOR=8 docker-compose -f docker-compose/test.yml run kuzzle
