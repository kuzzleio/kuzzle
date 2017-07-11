#!/usr/bin/env bash

cd "$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." && pwd )"

set -e

proxy_host="${CUCUMBER_PROXY_HOST:-localhost}"
embedded_host="${CUCUMBER_EMBEDDED_HOST:-localhost}"

for endpoint in Embedded Proxy; do
  for protocol in websocket http socketio; do
    if [ "$endpoint" == "Proxy" ]; then
      host="$proxy_host"
    else
      host="$embedded_host"
    fi
    ./node_modules/.bin/cucumberjs --format progress-bar -p "${protocol}${endpoint}" --world-parameters "{\"host\": \"${host}\"}"
  done
done
