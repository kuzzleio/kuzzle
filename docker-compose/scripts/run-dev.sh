#!/bin/sh

set -e

elastic_host=${kuzzle_services__db__client__host:-http://elasticsearch:9200}

npm install --unsafe-perm
npm rebuild all --unsafe-perm
chmod -R 777 node_modules/
docker-compose/scripts/install-plugins.sh

echo "[$(date --rfc-3339 seconds)] - Waiting for elasticsearch to be available"
while ! curl -f -s -o /dev/null "$elastic_host"
do
    echo "[$(date --rfc-3339 seconds)] - Still trying to connect to $elastic_host"
    sleep 1
done

echo "[$(date --rfc-3339 seconds)] - Elasticsearch is up. Waiting for shards to be active (can take a while)"
E=$(curl -s "$elastic_host/_cluster/health?wait_for_status=yellow&timeout=60s")

if ! (echo ${E} | grep -E '"status":"(yellow|green)"' > /dev/null); then
    echo "============ Cluster health response"
    echo $E
    echo "============ Cluster allocation explanation"
    curl -s http://$elastic_host/_cluster/allocation/explain?pretty
    echo "[$(date --rfc-3339 seconds)] - Could not connect to elasticsearch in time. Aborting..."
    exit 1
fi

echo "[$(date --rfc-3339 seconds)] - Starting Kuzzle..."

pm2 start /config/pm2.json
pm2 logs --lines 2
