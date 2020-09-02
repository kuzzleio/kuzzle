#!/bin/bash

COMPOSE_FILE=npm-install.yml

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR/docker-compose"

_exit() {
    docker-compose -f "$COMPOSE_FILE" stop
}

trap _exit SIGINT SIGTERM EXIT

. ./build-compose.sh

# main
(
  . ./my.env

  # lb
  export LB_IMAGE=${LB_IMAGE:-kuzzleio/kuzzle}
  export LB_VOLUME="[]"


  # kuzzle
  export KUZ_IMAGE=${KUZ_IMAGE:-kuzzleio/kuzzle}
  export KUZ_VOLUME=""
  if [ "$KUZ_PATH" != "" ]; then
    export KUZ_VOLUME="- \"$(readlink -f ${KUZ_PATH}):/var/app\""
  fi

  envsubst < "$COMPOSE_FILE.tpl" > "$COMPOSE_FILE"
)

docker-compose -p cluster -f "$COMPOSE_FILE" kill
docker-compose -p cluster -f "$COMPOSE_FILE" rm -fv 2> /dev/null
docker-compose -p cluster -f "$COMPOSE_FILE" pull
docker-compose -p cluster -f "$COMPOSE_FILE" build
docker-compose -p cluster -f "$COMPOSE_FILE" up --scale kuzzle=1


