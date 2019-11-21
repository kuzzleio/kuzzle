#!/bin/sh

set -e

if [ ! -z "$WITHOUT_KUZZLE" ]; then
  exit 0
fi

elastic_host=${kuzzle_services__storageEngine__client__node:-http://elasticsearch:9200}

if [ ! -z "$TRAVIS" ] || [ ! -z "$REBUILD" ]; then
    npm ci --unsafe-perm
    chmod -R 777 node_modules/
    npm rebuild all --unsafe-perm
    docker-compose/scripts/install-plugins.sh
fi

spinner="/"
echo "[$(date --rfc-3339 seconds)] - Waiting for elasticsearch to be available"
while ! curl -f -s -o /dev/null "$elastic_host"
do
    printf '\r'
    echo -n "[$(date --rfc-3339 seconds)] - Still trying to connect to $elastic_host [$spinner]"
    sleep 1

    if [ "$spinner" = "/" ]; then spinner="\\";  else spinner="/" ; fi
done

# create a tmp index just to force the shards to init
curl -XPUT -s -o /dev/null "$elastic_host/%25___tmp"
echo "[$(date --rfc-3339 seconds)] - Elasticsearch is up. Waiting for shards to be active (can take a while)"
E=$(curl -s "$elastic_host/_cluster/health?wait_for_status=yellow&wait_for_active_shards=1&timeout=60s")
curl -XDELETE -s -o /dev/null "$elastic_host/%25___tmp"

if ! (echo ${E} | grep -E '"status":"(yellow|green)"' > /dev/null); then
    echo "[$(date --rfc-3339 seconds)] - Could not connect to elasticsearch in time. Aborting..."
    exit 1
fi

echo "[$(date --rfc-3339 seconds)] - Starting Kuzzle..."

pm2 start /config/pm2.json
pm2 logs --lines 2
