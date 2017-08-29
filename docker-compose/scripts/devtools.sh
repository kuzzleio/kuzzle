#!/bin/bash

for container in $(docker ps | grep kuzzle | sed -E 's#^([^ ]+).*#\1#'); do
  name=$(docker inspect --format '{{.Name}}' "$container")

  ip=$(docker inspect --format='{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' "$container")

  url=$(docker exec -t ${container} bash -c 'zgrep devtools /root/.pm2/logs/*.log | tail -n 1')
  url=$(echo $url | sed -E 's|[^ ]+\s+||')
  url=$(echo $url | sed -E "s|\&ws=127\.0\.0\.1|\&ws=${ip}|")

  echo "$name"
  echo "$url"
done
