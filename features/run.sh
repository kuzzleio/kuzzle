#!/usr/bin/env bash

cd "$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." && pwd )"

set -e

# profiles are defined in the cucumber.js file at the root of this project

# http
./node_modules/.bin/cucumber-js --format progress-bar --profile "http"

# websocket
./node_modules/.bin/cucumber-js --format progress-bar --profile "websocket"

# mqtt
./node_modules/.bin/cucumber-js --format progress-bar --profile "mqtt"
