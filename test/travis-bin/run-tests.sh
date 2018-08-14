#!/bin/bash

set -e

section () {
  echo 
  echo
  echo "-----------------------------------------------------------------------"
  echo "  $1"
  echo "-----------------------------------------------------------------------"
  echo 
  echo 
  echo 
  sleep 2

}

sudo sysctl -w vm.max_map_count=262144

if [ "${TRAVIS_BRANCH}" != "master" ]; then
  export DOCKER_PROXY_TAG=":develop"
fi

section "x64 - node 6"
NODE_LTS=6 docker-compose -f docker-compose/test.yml run kuzzle
section "x64 - node 8"
NODE_LTS=8 docker-compose -f docker-compose/test.yml run kuzzle

section "armhf"
docker-compose -f docker-compose/test-armhf.yml run kuzzle
section "aarch64"
docker-compose -f docker-compose/test-aarch64.yml run kuzzle
