#!/bin/sh

set -e

ELASTIC=${READ_ENGINE_HOST:-elasticsearch:9200}

npm install

echo "Waiting for elasticsearch to be available"
E=$(curl -s "http://${ELASTIC}/_cluster/health?wait_for_status=yellow&timeout=60s")

if ! (echo ${E} | grep -E '"status":"(yellow|green)"' > /dev/null); then
    echo "Could not connect to elasticsearch in time. Aborting..."
    exit 1
fi

echo "Starting Kuzzle..."

node bin/kuzzle install && pm2 start /config/processes-dev.json
pm2 logs
