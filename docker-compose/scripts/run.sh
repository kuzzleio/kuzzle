#!/bin/sh

ELASTIC=${READ_ENGINE_HOST:-elasticsearch:9200}

echo "Waiting for elasticsearch to be available"
while ! curl -f -s -o /dev/null "http://$ELASTIC"
do
    echo "$(date) - still trying connecting to http://$ELASTIC"
    sleep 1
done
# create a tmp index just to force the shards to init
curl -XPUT -s -o /dev/null "http://$ELASTIC/%25___tmp"
echo "Elasticsearch is up. Waiting for shards to be active (can take a while)"
E=$(curl -s "http://${ELASTIC}/_cluster/health?wait_for_status=yellow&wait_for_active_shards=1&timeout=60s")
curl -XDELETE -s -o /dev/null "http://$ELASTIC/%25___tmp"

if ! (echo ${E} | grep -E '"status":"(yellow|green)"' > /dev/null); then
    echo "Could not connect to elasticsearch in time. Aborting..."
    exit 1
fi

npm install

echo "Starting Kuzzle..."

pm2 start /config/pm2.json --silent
pm2 logs
