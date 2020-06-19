#!/bin/sh

set -e

elastic_host=${kuzzle_services__storageEngine__client__node:-http://elasticsearch:9200}

NODE_VERSION=$NODE_12_VERSION

echo "Testing Kuzzle against node v$NODE_VERSION"
n $NODE_VERSION

npm install --silent --unsafe-perm
ls
pwd
./docker/scripts/install-plugins.sh

echo "[$(date)] - Starting Kuzzle..."

node bin/start-kuzzle-server --enable-plugins functional-test-plugin &

./bin/wait-kuzzle

npm run $KUZZLE_FUNCTIONAL_TESTS
