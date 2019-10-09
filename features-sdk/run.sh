#!/usr/bin/env bash

cd "$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." && pwd )"

set -e

for protocol in websocket http; do
  # profiles are defined in the cucumber.js file at the root of this project
  KUZZLE_PROTOCOL=$protocol ./node_modules/.bin/cucumber-js features-sdk/ --format progress-bar
done
