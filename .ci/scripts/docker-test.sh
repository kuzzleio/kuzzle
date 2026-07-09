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
  .ci/scripts/docker-test.sh unit <vitest|mocha>
  .ci/scripts/docker-test.sh functional <http|websocket|legacy:http|legacy:mqtt|legacy:websocket> [-- <cucumber-js args>]

Env vars:
  ES_VERSION   Elasticsearch major version for functional tests: 7 or 8 (default: 7)

Examples:
  .ci/scripts/docker-test.sh unit vitest
  .ci/scripts/docker-test.sh unit mocha
  .ci/scripts/docker-test.sh functional websocket
  ES_VERSION=8 .ci/scripts/docker-test.sh functional http

  # Target a single feature file or a tag instead of the whole suite:
  .ci/scripts/docker-test.sh functional websocket -- features/api/document.feature
  .ci/scripts/docker-test.sh functional http -- --tags "@security"
EOF
}

run_unit() {
  local suite="$1"

  case "$suite" in
    vitest|mocha) ;;
    *)
      echo "Unknown unit suite: '$suite' (expected 'vitest' or 'mocha')" >&2
      exit 1
      ;;
  esac

  docker compose -f docker-compose.yml run --rm --no-deps \
    -e NODE_ENV=test \
    node bash -lc "npm ci && npm run build && npm run test:unit:${suite}"
}

run_functional() {
  local suite="$1"
  shift
  local test_script="test:functional:${suite}"
  local yml_file
  local extra_args=("$@")

  case "$ES_VERSION" in
    7) yml_file=".ci/test-cluster-7.yml" ;;
    8) yml_file=".ci/test-cluster-8.yml" ;;
    *)
      echo "Invalid ES_VERSION '$ES_VERSION' (expected 7 or 8)" >&2
      exit 1
      ;;
  esac

  trap 'docker compose -f "$yml_file" logs --tail=200' ERR

  docker compose -f "$yml_file" down -v

  echo "Installing dependencies..."
  docker compose -f "$yml_file" run --rm --no-deps kuzzle_node_1 npm ci

  echo "Starting Kuzzle cluster..."
  docker compose -f "$yml_file" up -d

  echo "Waiting for the cluster to be reachable..."
  docker compose -f "$yml_file" run --rm --no-deps \
    -e KUZZLE_HOST=kuzzle_node_1 -e KUZZLE_PORT=7512 kuzzle_node_1 node bin/wait-kuzzle
  docker compose -f "$yml_file" run --rm --no-deps \
    -e KUZZLE_HOST=kuzzle_node_2 -e KUZZLE_PORT=7512 kuzzle_node_1 node bin/wait-kuzzle
  docker compose -f "$yml_file" run --rm --no-deps \
    -e KUZZLE_HOST=kuzzle_node_3 -e KUZZLE_PORT=7512 kuzzle_node_1 node bin/wait-kuzzle
  docker compose -f "$yml_file" run --rm --no-deps \
    -e KUZZLE_HOST=nginx -e KUZZLE_PORT=7512 kuzzle_node_1 node bin/wait-kuzzle

  trap - ERR

  if [ "${#extra_args[@]}" -gt 0 ] && [ "${extra_args[0]}" = "--" ]; then
    extra_args=("${extra_args[@]:1}")
  fi

  if [ "${#extra_args[@]}" -gt 0 ]; then
    echo "Running functional tests: ${test_script} -- ${extra_args[*]}"
    docker compose -f "$yml_file" run --rm --no-deps \
      -e KUZZLE_HOST=nginx \
      kuzzle_node_1 npm run "$test_script" -- "${extra_args[@]}"
  else
    echo "Running functional tests: ${test_script}"
    docker compose -f "$yml_file" run --rm --no-deps \
      -e KUZZLE_HOST=nginx \
      kuzzle_node_1 npm run "$test_script"
  fi
}

case "${1:-}" in
  unit)
    run_unit "${2:?Missing unit suite: vitest|mocha}"
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
