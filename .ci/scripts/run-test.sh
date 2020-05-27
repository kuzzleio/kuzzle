#!/bin/sh

set -e

elastic_host=${kuzzle_services__storageEngine__client__node:-http://elasticsearch:9200}

NODE_VERSION=$NODE_12_VERSION

echo "Testing Kuzzle against node v$NODE_VERSION"
n $NODE_VERSION

npm install --silent --unsafe-perm
chmod -R 777 node_modules/
./docker/scripts/install-plugins.sh

node bin/start-kuzzle-server --enable-plugins functional-test-plugin &

echo "[$(date)] - Starting Kuzzle..."

npm run test:functional
