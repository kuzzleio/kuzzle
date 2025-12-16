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

trap 'docker compose -f $YML_FILE logs' err

docker compose -f $YML_FILE up -d

# don't wait on 7512: nginx will accept connections far before Kuzzle does
KUZZLE_PORT=17510 ./bin/wait-kuzzle
KUZZLE_PORT=17511 ./bin/wait-kuzzle
KUZZLE_PORT=17512 ./bin/wait-kuzzle

trap - err

echo "Installing Kuzzle Monkey Tester..."

cd kuzzle-monkey-tests
npm ci
node index.js