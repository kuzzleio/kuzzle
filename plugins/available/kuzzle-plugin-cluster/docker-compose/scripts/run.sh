#!/bin/sh

set -eu

ELASTIC_HOST=${kuzzle_services__db__host:-elasticsearch}
ELASTIC_PORT=${kuzzle_services__db__port:-9200}

echo "[$(date --rfc-3339 seconds)][cluster] - Waiting for elasticsearch to be available"
while ! curl -f -s -o /dev/null "http://$ELASTIC_HOST:$ELASTIC_PORT"
do
    echo "[$(date --rfc-3339 seconds)][cluster] - Still trying to connect to http://$ELASTIC_HOST:$ELASTIC_PORT"
    sleep 1
done
# create a tmp index just to force the shards to init
curl -XPUT -s -o /dev/null "http://$ELASTIC_HOST:$ELASTIC_PORT/%25___tmp"
echo "[$(date --rfc-3339 seconds)][cluster] - Elasticsearch is up. Waiting for shards to be active (can take a while)"
E=$(curl -s "http://$ELASTIC_HOST:$ELASTIC_PORT/_cluster/health?wait_for_status=yellow&wait_for_active_shards=1&timeout=60s")
curl -XDELETE -s -o /dev/null "http://$ELASTIC_HOST:$ELASTIC_PORT/%25___tmp"

if ! (echo ${E} | grep -E '"status":"(yellow|green)"' > /dev/null); then
    echo "[$(date --rfc-3339 seconds)][cluster] - Could not connect to elasticsearch in time. Aborting..."
    exit 1
fi

echo "[$(date --rfc-3339 seconds)][cluster] - Starting Kuzzle..."

pm2 start --silent /config/pm2.json
pm2 logs --lines 0 --raw
