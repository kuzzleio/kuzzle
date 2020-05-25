#!/bin/sh

set -e

log () {
  echo "[$(date)] - $1"
}

if [ -z "$PLUGIN_NAME" ]; then
  echo "PLUGIN_NAME environment variable is not set"
  exit 1
fi

elastic_host=${kuzzle_services__db__client__host:-http://elasticsearch:9200}

plugin_name=$PLUGIN_NAME

echo "Installing plugin $plugin_name dependencies"
cd /var/app/plugins/enabled/$plugin_name && npm install --unsafe-perm && chmod 777 node_modules/

log "Waiting for elasticsearch"
while ! curl -f -s -o /dev/null "$elastic_host"
do
    log "Still trying to connect to $elastic_host"
    sleep 1
done
# create a tmp index just to force the shards to init
curl -XPUT -s -o /dev/null "$elastic_host/%25___tmp"
log "Elasticsearch is up. Waiting for shards..."
E=$(curl -s "$elastic_host/_cluster/health?wait_for_status=yellow&wait_for_active_shards=1&timeout=60s")
curl -XDELETE -s -o /dev/null "$elastic_host/%25___tmp"

if ! (echo ${E} | grep -E '"status":"(yellow|green)"' > /dev/null); then
    log "Could not connect to elasticsearch in time. Aborting..."
    exit 1
fi

log "Starting Kuzzle..."

cd /var/app

nodemon \
    --inspect=0.0.0.0:9229 \
    bin/start-kuzzle-server
