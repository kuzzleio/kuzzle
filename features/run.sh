#!/usr/bin/env bash

cd "$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." && pwd )"

set -e

proxy_host="${CUCUMBER_PROXY_HOST:-localhost}"
embedded_host="${CUCUMBER_EMBEDDED_HOST:-localhost}"
proxy_port="${CUCUMBER_PROXY_PORT:-7513}"
embedded_port="${CUCUMBER_EMBEDDED_PORT:-7512}"

for endpoint in Embedded Proxy; do
  for protocol in websocket http socketio; do
    if [ "$endpoint" == "Proxy" ]; then
      host="$proxy_host"
      port="$proxy_port"
    else
      host="$embedded_host"
      port="$embedded_port"
    fi

    # profiles are defined in the cucumber.js file at the root of this project
    ./node_modules/.bin/cucumber-js --format progress-bar --profile "${protocol}${endpoint}"
  done
done
