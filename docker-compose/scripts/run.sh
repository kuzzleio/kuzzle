#!/bin/sh

set -e

echo "Decompressing Kuzzle.."

tar xf app.tar.lzma

cd /var/app

elastic_host=${kuzzle_services__storageEngine__client__node:-http://elasticsearch:9200}

echo "[$(date)] Waiting for elasticsearch"
spinner="/"
while ! curl -f -s -o /dev/null "$elastic_host"
do
    printf '\r'
    echo -n "[$(date)] Still trying to connect to $elastic_host [$spinner]"
    if [ "$spinner" = "/" ]; then spinner="\\";  else spinner="/" ; fi
    sleep 1
done
# create a tmp index just to force the shards to init
echo "[$(date)] Elasticsearch is up. Waiting for shards..."
E=$(curl -s "$elastic_host/_cluster/health?wait_for_status=yellow&timeout=60s")

if ! (echo ${E} | grep -E '"status":"(yellow|green)"' > /dev/null); then
    echo "============ Cluster health response"
    echo $E
    echo "============ Cluster allocation explanation"
    curl -s http://$elastic_host/_cluster/allocation/explain?pretty
    echo "[$(date)] - Could not connect to elasticsearch in time. Aborting..."
    exit 1
fi

echo "[$(date)] Starting Kuzzle..."

if [ -n "$KUZZLE_PLUGINS" ]; then
  enable_plugins="--enable-plugins $KUZZLE_PLUGINS"
fi

exec ./bin/start-kuzzle-server "$@" $enable_plugins
