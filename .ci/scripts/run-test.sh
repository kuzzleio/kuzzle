#!/bin/sh

set -e

elastic_host=${kuzzle_services__storageEngine__client__node:-http://elasticsearch:9200}

NODE_VERSION=$NODE_12_VERSION

echo "Testing Kuzzle against node v$NODE_VERSION"
n $NODE_VERSION

npm install --silent --unsafe-perm
npm install --silent --unsafe-perm --only=dev
chmod -R 777 node_modules/
docker-compose/scripts/install-plugins.sh

echo "[$(date --rfc-3339 seconds)] - Waiting for elasticsearch to be available"
while ! curl -f -s -o /dev/null "$elastic_host"
do
    echo "[$(date --rfc-3339 seconds)] - Still trying to connect to $elastic_host"
    sleep 1
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

node bin/start-kuzzle-server --enable-plugins functional-test-plugin &

echo "[$(date --rfc-3339 seconds)] - Starting Kuzzle..."
while ! curl -f -s -o /dev/null http://localhost:7512
do
    echo "[$(date --rfc-3339 seconds)] - Still trying to connect to Kuzzle"
    sleep 1
done

npm run functional-testing
npm run functional-testing2
