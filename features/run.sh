#!/usr/bin/env bash

cd "$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." && pwd )"

set -e

host="${CUCUMBER_EMBEDDED_HOST:-localhost}"
port="${CUCUMBER_EMBEDDED_PORT:-7512}"

for protocol in websocket http socketio; do
  # profiles are defined in the cucumber.js file at the root of this project
  ./node_modules/.bin/cucumber-js \
    --format progress-bar \
    --profile "${protocol}" \
    --world-parameters "{\"host\": \"${host}\", \"port\": \"${port}\"}"
done

# mqtt
./node_modules/.bin/cucumber-js \
  --format progress-bar \
  --profile "mqtt" \
  --world-parameters "{\"host\": \"${host}\"}"
