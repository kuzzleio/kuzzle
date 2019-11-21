#!/bin/sh

set -e

log () {
  echo "[$(date --rfc-3339 seconds)] - $1"
}

elastic_host=${kuzzle_services__db__client__host:-http://elasticsearch:9200}

log "Waiting for elasticsearch"
while ! curl -f -s -o /dev/null "$elastic_host"
do
    log "Still trying to connect to $elastic_host"
    sleep 1
done

log "Elasticsearch is up. Waiting for shards..."
E=$(curl -s "$elastic_host/_cluster/health?wait_for_status=yellow&timeout=60s")

if ! (echo ${E} | grep -E '"status":"(yellow|green)"' > /dev/null); then
    echo "============ Cluster health response"
    echo $E
    echo "============ Cluster allocation explanation"
    curl -s http://$elastic_host/_cluster/allocation/explain?pretty
    echo "[$(date --rfc-3339 seconds)] - Could not connect to elasticsearch in time. Aborting..."
    exit 1
fi

log "Starting Kuzzle..."

exec ./bin/kuzzle "$@"
