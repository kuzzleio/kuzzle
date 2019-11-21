#!/bin/sh

set -e

elastic_host=${kuzzle_services__db__client__host:-http://elasticsearch:9200}

if [ "$NODE_LTS" = "6" ]; then
  NODE_VERSION=$NODE_6_VERSION
elif [ "$NODE_LTS" = "8" ]; then
  NODE_VERSION=$NODE_8_VERSION
else
  echo "Unsupported Node LTS: $NODE_LTS"
  exit 1
fi

echo "Testing Kuzzle against node v$NODE_VERSION"

export NVM_DIR="$HOME/.nvm"
. "$NVM_DIR/nvm.sh"
nvm use $NODE_VERSION


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

node bin/kuzzle start &
echo "[$(date --rfc-3339 seconds)] - Starting Kuzzle..."
while ! curl -f -s -o /dev/null http://localhost:7512
do
    echo "[$(date --rfc-3339 seconds)] - Still trying to connect to Kuzzle"
    sleep 1
done

npm run functional-testing
