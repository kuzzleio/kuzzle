#!/bin/sh

set -e

cd /var/app

if [ -n "$KUZZLE_PLUGINS" ]; then
  enable_plugins="--enable-plugins $KUZZLE_PLUGINS"
fi

exec ./bin/start-kuzzle-server "$@" $enable_plugins
