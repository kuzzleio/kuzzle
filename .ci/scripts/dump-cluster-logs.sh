#!/bin/bash
#
# Shared failure handler for the two scripts that bring up the test cluster.
#
# On failure the question is always the same — which nodes saw each other — and
# `docker compose logs` is the wrong shape to answer it: four Kuzzle nodes
# interleaved with Elasticsearch's JSON firehose, thousands of lines deep, in
# one flat block. Each Kuzzle service gets its own collapsible group; the
# infrastructure is tail-limited, because it has never been the answer.
#
# Expects $YML_FILE to be set. Source it, then `trap dump_cluster_logs err`.
#
# `check_cluster_logs` is the other half, for a green suite: see below.

dump_cluster_logs() {
  for service in kuzzle_node_1 kuzzle_node_2 kuzzle_node_3 kuzzle_node_prod; do
    echo "::group::logs $service"
    docker compose -f "$YML_FILE" logs --no-color "$service" || true
    echo "::endgroup::"
  done

  echo "::group::logs elasticsearch/redis/nginx (tail)"
  docker compose -f "$YML_FILE" logs --no-color --tail 100 elasticsearch redis nginx || true
  echo "::endgroup::"
}

# A green suite says nothing about the cluster under it: the scenarios go
# through nginx, and a node that left the cluster mid-run is invisible to
# them. F-12 (step 15, 2026-09-25) was only seen because it broke the
# cluster's formation; a node evicting itself *after* the formation would
# have passed. No scenario evicts a node on purpose, so any eviction or
# out-of-sync line in a functional job is a cluster defect.
#
# Not for the monkey tests, which kill nodes on purpose.
cluster_log_alarm='\[CLUSTER\].*(evicted|out-of-sync|Unable to process sync message|ID Card renewer)'

check_cluster_logs() {
  local matches

  # `|| true`: no match is the good case, and the callers run under `set -e`.
  matches=$(
    docker compose -f "$YML_FILE" logs --no-color \
      kuzzle_node_1 kuzzle_node_2 kuzzle_node_3 kuzzle_node_prod |
      grep -E "$cluster_log_alarm" || true
  )

  if [ -n "$matches" ]; then
    echo "::error::The suite passed, but the cluster evicted a node or lost messages:"
    echo "$matches"
    return 1
  fi
}
