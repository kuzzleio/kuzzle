#!/bin/sh

set -e

echo "[$(date --rfc-3339 seconds)] - Waiting for Kuzzle to be up..."

spinner="/"
while ! curl -f -s -o /dev/null http://localhost:7512
do
    printf '\r'
    echo -n "[$(date --rfc-3339 seconds)] - Still trying to connect to Kuzzle [$spinner]"

    if [ "$spinner" = "/" ]; then spinner="\\";  else spinner="/" ; fi

    sleep 1
done
