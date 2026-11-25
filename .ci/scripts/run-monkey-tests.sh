#!/bin/bash

# Fail on any error: without it, a tester that crashed at startup (e.g. its
# `npm ci` failing) still left the job green, since the script's last command
# is the `trap` reset below.
set -eo pipefail

# Absolute, because the monkey-tester install below runs from another directory.
WITH_RETRY="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/with-retry.sh"

# `bin/wait-kuzzle.ts` is TypeScript and not part of the published build, so it
# runs through `ts-node` — the same idiom as `.ci/test-cluster-*.yml` for
# `start-kuzzle-test.ts`. See docs/adr-001/steps/03-sprint-2-bin.md.
WAIT_KUZZLE=(node -r ts-node/register/transpile-only ./bin/wait-kuzzle.ts)

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
# Same npm cache mount as run-test-cluster.sh (NPM_CACHE_DIR, set by CI).
NPM_CACHE_MOUNT=()
if [ -n "${NPM_CACHE_DIR:-}" ]; then
  mkdir -p "$NPM_CACHE_DIR"
  NPM_CACHE_MOUNT=(-v "$NPM_CACHE_DIR:/var/npm")
fi

# Retried, same reason as run-test-cluster.sh: .ci/scripts/with-retry.sh (TD-83).
"$WITH_RETRY" \
  docker compose -f $YML_FILE run --rm --no-deps "${NPM_CACHE_MOUNT[@]}" kuzzle_node_1 npm ci --prefer-offline

# The container runs as root, so the files it added to the shared cache are
# root-owned, and the tester's own `npm ci` below, run as the runner user,
# failed on them with EACCES. Hand the cache back to the runner user.
if [ -n "${NPM_CACHE_DIR:-}" ]; then
  docker compose -f $YML_FILE run --rm --no-deps "${NPM_CACHE_MOUNT[@]}" \
    --entrypoint chown kuzzle_node_1 -R "$(id -u):$(id -g)" /var/npm
fi

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
KUZZLE_PORT=17510 "${WAIT_KUZZLE[@]}"
KUZZLE_PORT=17511 "${WAIT_KUZZLE[@]}"
KUZZLE_PORT=17512 "${WAIT_KUZZLE[@]}"

echo "Installing Kuzzle Monkey Tester..."

# In a subshell: dump_cluster_logs (the err trap) reads $YML_FILE, relative to
# the repository root.
(cd kuzzle-monkey-tests && "$WITH_RETRY" npm ci)

# The trap stays on for the run, for the same reason as run-test-cluster.sh: the
# monkey failures in TD-33 (#2715) — `core.realtime.room_not_found`, seeds
# d6432db20ca96eff and c884b3318030acc7 — are exactly the case where the nodes'
# own view is the evidence, and clearing the trap here is why neither produced
# any.
(cd kuzzle-monkey-tests && node index.js)

trap - err