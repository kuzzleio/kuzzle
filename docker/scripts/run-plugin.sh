#!/bin/sh

set -e

if [ -z "$PLUGIN_NAME" ]; then
  echo "PLUGIN_NAME environment variable is not set"
  exit 1
fi

plugin_name=$PLUGIN_NAME

echo "[$(date)] - Installing plugin $plugin_name dependencies"

cd /var/app/plugins/enabled/$plugin_name && npm install --unsafe-perm && chmod 777 node_modules/

cd /var/app

nodemon \
    --inspect=0.0.0.0:9229 \
    bin/start-kuzzle-server \
    $@
