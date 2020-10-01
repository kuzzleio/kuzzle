#!/bin/bash 

for container in $(docker ps | grep kuzzle_ | awk '{ print $1 }'); do
  name=$(docker inspect --format '{{.Name}}' "$container")
  network=$(docker inspect --format '{{.HostConfig.NetworkMode}}' $container)
  ip=$(docker inspect --format='{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' "$container")

  id=$(docker run -ti \
    --network $network \
      endeveit/docker-jq ash -c \
      "curl -s http://$ip:9229/json/list | jq -Mrce '.[0].id'")
  url="chrome-devtools://devtools/bundled/inspector.html?experiments=true&v8only=true&ws=$ip:9229/$id"

  echo "  $name"
  echo "  $url"
done
