#!/bin/sh

set -e

elastic_host=${kuzzle_services__storageEngine__client__node:-http://elasticsearch:9200}

echo "[$(date --rfc-3339 seconds)] Waiting for elasticsearch"
spinner="/"
while ! curl -f -s -o /dev/null "$elastic_host"
do
    printf '\r'
    echo "[$(date --rfc-3339 seconds)] Still trying to connect to $elastic_host [$spinner]"
    if [ "$spinner" = "/" ]; then spinner="\\";  else spinner="/" ; fi
    sleep 1
done
# create a tmp index just to force the shards to init
echo "[$(date --rfc-3339 seconds)] Elasticsearch is up. Waiting for shards..."
E=$(curl -s "$elastic_host/_cluster/health?wait_for_status=yellow&timeout=60s")

if ! (echo ${E} | grep -E '"status":"(yellow|green)"' > /dev/null); then
    echo "Could not connect to elasticsearch in time. Aborting..."
    exit 1
fi

echo "[$(date --rfc-3339 seconds)] Starting Kuzzle..."

if [ -n "$KUZZLE_PLUGINS" ]; then
  enable_plugins="--enable-plugins $KUZZLE_PLUGINS"
fi

exec ./bin/start-kuzzle-server "$@" $enable_plugins
