#!/usr/bin/env bash

cd "$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." && pwd )"

set -e

export SCOPE=${1:-features-sdk}

for protocol in websocket http; do
  # profiles are defined in the cucumber.js file at the root of this project
  KUZZLE_PROTOCOL=$protocol npx cucumber-js --profile $protocol $SCOPE
done
