echo "Testing Kuzzle against node v$NODE_VERSION"

if [ "$ES_VERSION" == "7" ]; then
    YML_FILE='./.ci/test-cluster-7.yml'
elif [ "$ES_VERSION" == "8" ]; then
    YML_FILE='./.ci/test-cluster-8.yml'
else
    echo "Invalid ES_VERSION. It should be either '7' or '8'."
    exit 1 
fi

docker compose -f $YML_FILE down -v

echo "Installing dependencies..."
docker compose -f $YML_FILE run --rm --no-deps kuzzle_node_1 npm ci

if [ "$REBUILD" == "true" ]; then
    docker compose -f $YML_FILE run --rm --no-deps kuzzle_node_1 npm rebuild
fi

docker compose -f $YML_FILE run --rm --no-deps kuzzle_node_1 npm run build

echo "[$(date)] - Starting Kuzzle Cluster..."

# shellcheck source=./dump-cluster-logs.sh
source "$(dirname "${BASH_SOURCE[0]}")/dump-cluster-logs.sh"

trap dump_cluster_logs err

docker compose -f $YML_FILE up -d

# don't wait on 7512: nginx will accept connections far before Kuzzle does
KUZZLE_PORT=17510 ./bin/wait-kuzzle
KUZZLE_PORT=17511 ./bin/wait-kuzzle
KUZZLE_PORT=17512 ./bin/wait-kuzzle

echo "Installing Kuzzle Monkey Tester..."

cd kuzzle-monkey-tests
npm ci

# The trap stays on for the run, for the same reason as run-test-cluster.sh: the
# monkey failures in TD-33 (#2715) — `core.realtime.room_not_found`, seeds
# d6432db20ca96eff and c884b3318030acc7 — are exactly the case where the nodes'
# own view is the evidence, and clearing the trap here is why neither produced
# any.
node index.js

trap - err