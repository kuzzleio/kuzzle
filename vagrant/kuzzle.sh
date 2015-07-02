#!/bin/bash

[ -z "$http_proxy" ] || (
    echo "Proxy detected, launching forgetproxy for docker"
    docker run -d --net=host --privileged -e http_proxy="$http_proxy" klabs/forgetproxy
)

echo "launching kuzzle"
cd /vagrant
docker-compose -p kuzzle up -d