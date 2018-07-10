#!/bin/bash

set -e

sudo sysctl -w vm.max_map_count=262144

if [ "${TRAVIS_BRANCH}" != "master" ]; then
  export DOCKER_PROXY_TAG=":develop"
fi

NODE_LTS=6 docker-compose -f docker-compose/test.yml run kuzzle

NODE_LTS=8 docker-compose -f docker-compose/test.yml run kuzzle
