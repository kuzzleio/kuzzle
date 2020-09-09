#!/bin/sh

set -ex

if [ -z "$NODE_VERSION" ];
then
  echo "Missing NODE_VERSION, use default NODE_12_VERSION"
  export NODE_VERSION=$NODE_12_VERSION
fi

echo "Testing Kuzzle against node v$NODE_VERSION"

n $NODE_VERSION

echo "Installing dependencies..."
npm ci --silent --unsafe-perm

./ci/scripts/install-plugins.sh

echo "[$(date)] - Starting Kuzzle Cluster..."

docker-compose -f ./docker-compose.yml up -d

./bin/wait-kuzzle

npm run test:functional:legacy:cluster
