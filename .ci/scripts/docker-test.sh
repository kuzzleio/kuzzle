#!/usr/bin/env bash
#
# Run Kuzzle's unit or functional test suites fully inside Docker.
# No local Node.js/npm install is required: dependencies, build and test
# execution all happen inside the project's Docker images.
#
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

ES_VERSION="${ES_VERSION:-7}"

usage() {
  cat <<'EOF'
Usage:
  .ci/scripts/docker-test.sh unit
  .ci/scripts/docker-test.sh conformance
  .ci/scripts/docker-test.sh functional <http|websocket|legacy:http|legacy:mqtt|legacy:websocket> [-- <cucumber-js args>]

Env vars:
  ES_VERSION      Elasticsearch major version for the conformance and
                  functional tests: 7 or 8 (default: 7)
  STORAGE_DRIVER  core-only: the functional tests run on a storage driver
                  declaring no optional capability (ADR-0003 step 04)
                  es9: they run on Elasticsearch 9 with the external driver
                  kuzzle-storage-es-9 (ADR-0003 step 05)
  ES9_DRIVER      What npm installs as that driver (default:
                  kuzzle-storage-es-9@beta); a local .tgz works too

Examples:
  .ci/scripts/docker-test.sh unit
  .ci/scripts/docker-test.sh functional websocket
  ES_VERSION=8 .ci/scripts/docker-test.sh functional http
  ES_VERSION=8 STORAGE_DRIVER=es9 .ci/scripts/docker-test.sh functional websocket

  # Target a single feature file or a tag instead of the whole suite:
  .ci/scripts/docker-test.sh functional websocket -- features/api/document.feature
  .ci/scripts/docker-test.sh functional http -- --tags "@security"
EOF
}

# One unit runner since ADR-0001 step 13 closed axis 2 — this took a
# <vitest|mocha> argument while the two suites ran side by side.
run_unit() {
  # `node_modules` lives in a named volume, NOT in the bind-mounted checkout.
  #
  # The repository is mounted at /var/app, so without this the container's
  # `npm ci` deletes and rewrites the HOST's `node_modules` — leaving Linux
  # native builds in a macOS checkout (host `node` then cannot load `re2`),
  # and, when the install fails partway, leaving the host with an empty tree
  # and no toolchain at all. Both happened. See #2790.
  #
  # The volume also survives between runs, so repeated local runs reinstall
  # into a warm tree instead of a bare one.
  docker compose -f docker-compose.yml run --rm --no-deps \
    -v kuzzle_test_node_modules:/var/app/node_modules \
    -e NODE_ENV=test \
    node bash -lc "npm ci && npm run build && npm run test:unit:vitest"
}

cluster_file() {
  case "$ES_VERSION" in
    7) echo ".ci/test-cluster-7.yml" ;;
    8) echo ".ci/test-cluster-8.yml" ;;
    *)
      echo "Invalid ES_VERSION '$ES_VERSION' (expected 7 or 8)" >&2
      exit 1
      ;;
  esac
}

# The storage driver conformance kit against the built-in driver of
# ES_VERSION (ADR-0003 step 04): the test cluster's Elasticsearch only, in a
# compose project of its own, so that it neither reuses nor tears down a
# functional test cluster.
run_conformance() {
  local yml_file
  yml_file="$(cluster_file)"

  local compose=(docker compose -p kuzzle-conformance -f "$yml_file" -f .ci/docker-test-node-modules.yml)

  # Expanded now: `compose` is local, and the trap runs after this function
  # returns. Keeps the node_modules volume, so that the next run is warm.
  # shellcheck disable=SC2064
  trap "$(printf '%q ' "${compose[@]}") down" EXIT

  "${compose[@]}" up -d elasticsearch
  "${compose[@]}" run --rm --no-deps \
    -e ES_VERSION="$ES_VERSION" \
    -e KUZZLE_CONFORMANCE_ES_NODE=http://elasticsearch:9200 \
    kuzzle_node_1 bash -lc "npm ci && npm run test:conformance"
}

# Installs the external Elasticsearch 9 driver as an application would
# (.ci/scripts/stage-es9-driver.sh), in a container: no local npm needed.
stage_es9_driver() {
  local spec="${ES9_DRIVER:-kuzzle-storage-es-9@beta}"
  local mounts=(-v "$ROOT_DIR:/var/app")

  if [ -f "$spec" ]; then
    mounts+=(-v "$(cd "$(dirname "$spec")" && pwd)/$(basename "$spec"):/tmp/storage-es-9.tgz:ro")
    spec=/tmp/storage-es-9.tgz
  fi

  docker run --rm "${mounts[@]}" -w /var/app \
    kuzzleio/kuzzle-runner:"${NODE_VERSION:-24}"-trixie-slim \
    bash .ci/scripts/stage-es9-driver.sh "$spec"
}

run_functional() {
  local suite="$1"
  shift
  local test_script="test:functional:${suite}"
  local yml_file
  local extra_args=("$@")

  yml_file="$(cluster_file)"

  # `node_modules` lives in a named volume here too, NOT in the bind-mounted
  # checkout — same reason as `run_unit` (#2790). The cluster containers must
  # all see the installed tree, so the volume is declared for every Kuzzle
  # service in an overlay rather than passed to one `run`.
  local compose=(docker compose -f "$yml_file" -f .ci/docker-test-node-modules.yml)

  case "${STORAGE_DRIVER:-}" in
    "") ;;
    core-only) compose+=(-f .ci/test-cluster-core-only-driver.yml) ;;
    es9)
      if [ "$ES_VERSION" != 8 ]; then
        echo "STORAGE_DRIVER=es9 runs on top of the ES 8 cluster file: set ES_VERSION=8" >&2
        exit 1
      fi
      compose+=(-f .ci/test-cluster-es9-driver.yml)
      stage_es9_driver
      ;;
    *)
      echo "Invalid STORAGE_DRIVER '$STORAGE_DRIVER' (expected core-only or es9)" >&2
      exit 1
      ;;
  esac

  trap '"${compose[@]}" logs --tail=200' ERR

  "${compose[@]}" down -v

  echo "Installing dependencies..."
  "${compose[@]}" run --rm --no-deps kuzzle_node_1 npm ci

  echo "Starting Kuzzle cluster..."
  "${compose[@]}" up -d

  echo "Waiting for the cluster to be reachable..."
  # `bin/wait-kuzzle.ts` is TypeScript and not part of the published build, so
  # it runs through `ts-node` — the same idiom `.ci/test-cluster-*.yml` uses for
  # `start-kuzzle-test.ts`. See docs/adr-001/steps/03-sprint-2-bin.md.
  local wait_kuzzle=(node -r ts-node/register/transpile-only bin/wait-kuzzle.ts)

  "${compose[@]}" run --rm --no-deps \
    -e KUZZLE_HOST=kuzzle_node_1 -e KUZZLE_PORT=7512 kuzzle_node_1 "${wait_kuzzle[@]}"
  "${compose[@]}" run --rm --no-deps \
    -e KUZZLE_HOST=kuzzle_node_2 -e KUZZLE_PORT=7512 kuzzle_node_1 "${wait_kuzzle[@]}"
  "${compose[@]}" run --rm --no-deps \
    -e KUZZLE_HOST=kuzzle_node_3 -e KUZZLE_PORT=7512 kuzzle_node_1 "${wait_kuzzle[@]}"
  # The production-mode node: nginx does not balance over it, so nothing else
  # would wait for it, and features/StackTrace.feature addresses it directly.
  "${compose[@]}" run --rm --no-deps \
    -e KUZZLE_HOST=kuzzle_node_prod -e KUZZLE_PORT=7512 kuzzle_node_1 "${wait_kuzzle[@]}"
  "${compose[@]}" run --rm --no-deps \
    -e KUZZLE_HOST=nginx -e KUZZLE_PORT=7512 kuzzle_node_1 "${wait_kuzzle[@]}"

  trap - ERR

  # Scenarios that address one node rather than nginx (features/StackTrace.feature,
  # features/Cluster.feature's @cluster)
  # reach it by published port from the CI runner, and by service name from in
  # here — same reason KUZZLE_HOST is set above.
  local node_env_flags=(
    -e KUZZLE_DEV_HOST=kuzzle_node_1 -e KUZZLE_DEV_PORT=7512
    -e KUZZLE_PROD_HOST=kuzzle_node_prod -e KUZZLE_PROD_PORT=7512
    -e KUZZLE_CLUSTER_NODES=kuzzle_node_1:7512,kuzzle_node_2:7512,kuzzle_node_3:7512
  )

  if [ "${#extra_args[@]}" -gt 0 ] && [ "${extra_args[0]}" = "--" ]; then
    extra_args=("${extra_args[@]:1}")
  fi

  if [ "${#extra_args[@]}" -gt 0 ]; then
    echo "Running functional tests: ${test_script} -- ${extra_args[*]}"
    "${compose[@]}" run --rm --no-deps \
      -e KUZZLE_HOST=nginx \
      "${node_env_flags[@]}" \
      kuzzle_node_1 npm run "$test_script" -- "${extra_args[@]}"
  else
    echo "Running functional tests: ${test_script}"
    "${compose[@]}" run --rm --no-deps \
      -e KUZZLE_HOST=nginx \
      "${node_env_flags[@]}" \
      kuzzle_node_1 npm run "$test_script"
  fi
}

case "${1:-}" in
  unit)
    run_unit
    ;;
  conformance)
    run_conformance
    ;;
  functional)
    suite="${2:?Missing functional suite: e.g. http, websocket, legacy:http}"
    shift 2
    run_functional "$suite" "$@"
    ;;
  -h|--help|"")
    usage
    ;;
  *)
    usage
    exit 1
    ;;
esac
