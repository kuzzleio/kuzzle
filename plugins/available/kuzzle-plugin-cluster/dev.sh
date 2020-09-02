#!/usr/bin/env bash

compose_file=docker-compose.yml
kuz_nodes=3

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR/docker-compose"

_usage() {
  echo "Launch Kuzzle cluster stack."
  echo
  echo "Usage:"
  echo "  ./run.sh [options]"
  echo "  ./run.sh -h|--help"
  echo
  echo "Options:"
  echo "  -h, --help          Display this help and exits"
  echo "  -n, --nodes         Specifcy the number of kuzzle nodes to run (default: 3)"
  exit 0
}

_exit() {
  docker-compose -f "$compose_file" stop
}

for key in "$@"; do
  case ${key} in
    -h|--help)
      _usage
    ;;
    -n|--nodes)
      kuz_nodes="$2"
      shift
    ;;
    *)
      shift
    ;;
  esac
  shift
done

trap _exit SIGINT SIGTERM

. ./build-compose.sh

docker-compose -p cluster -f "$compose_file" kill
docker-compose -p cluster -f "$compose_file" build
docker-compose -p cluster -f "$compose_file" rm -fv 2> /dev/null
docker-compose -p cluster -f "$compose_file" up --scale kuzzle=${kuz_nodes} --scale redis=3
