#!/bin/sh

set -e

log () {
  echo "[$(date --rfc-3339 seconds)] - $1"
}

elastic_host=${kuzzle_services__storageEngine__client__node:-http://elasticsearch:9200}

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

exec ./bin/start-kuzzle-server "$@"
