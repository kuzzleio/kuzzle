#!/bin/bash

[ -z "$http_proxy" ] || (
    echo "Proxy detected, launching forgetproxy for docker"
    docker run -d --net=host --privileged -e http_proxy="$http_proxy" klabs/forgetproxy stop
    docker kill forgetproxy > /dev/null 2>&1
    docker rm forgetproxy > /dev/null 2>&1
    docker run -d --name forgetproxy --net=host --privileged -e http_proxy="$http_proxy" klabs/forgetproxy
)

echo "launching kuzzle"
cd /vagrant
docker compose -p kuzzle up -d