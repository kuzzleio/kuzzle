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
