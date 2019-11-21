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
spinner="/"
while ! curl -f -s -o /dev/null "$elastic_host"
do
    printf '\r'
    echo -n "[$(date --rfc-3339 seconds)] - Still trying to connect to $elastic_host [$spinner]"
    if [ "$spinner" = "/" ]; then spinner="\\";  else spinner="/" ; fi
    sleep 1
done
# create a tmp index just to force the shards to init
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

node bin/start-kuzzle-server --enable-plugins functional-test-plugin &

echo "[$(date --rfc-3339 seconds)] - Starting Kuzzle..."
timeout=$((20 * 60))
while ! curl -f -s -o /dev/null http://localhost:7512
do
    printf '\r'
    echo -n "[$(date --rfc-3339 seconds)] - Still trying to connect to Kuzzle [$spinner]"
    if [ "$spinner" = "/" ]; then spinner="\\";  else spinner="/" ; fi

    timeout=$((timeout - 1))
    if [ $timeout -eq 0 ]; then
        echo "[$(date --rfc-3339 seconds)] - Timeout"
    fi

    sleep 1
done

npm run functional-testing
npm run functional-testing2
