#!/usr/bin/env bash

ssh_key_path="${1:-$HOME/.ssh/id_rsa}"

root="$( cd "$( dirname "${BASH_SOURCE[0]}" )/../.." >/dev/null 2>&1 && pwd )"
cd "$root"

docker build \
  -t kuzzleio/kuzzle:1.11.0 \
  -f .ci/privatebuild/Dockerfile \
  --build-arg SSH_KEY="$(cat "$ssh_key_path")" \
  --no-cache \
  .

docker save kuzzleio/kuzzle:1.11.0 | gzip > ./.ci/privatebuild/kuzzle-1.11.0.docker.tar.gz
docker run -t \
  -v "${root}/.ci/privatebuild:/build" \
  kuzzleio/kuzzle:1.11.0 bash -c "tar -cvzf /build/kuzzle-1.11.0.node-10.tar.gz . && chown $(id -u):$(id -g) /build/*"
