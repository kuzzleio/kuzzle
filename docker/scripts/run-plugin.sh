#!/bin/sh

set -e

working_dir="/var/app"
plugins_dir="plugins/enabled"

cd "$working_dir"

# If the plugin name is provided, only install it's dependencies
if [ -n "$KUZZLE_PLUGIN_NAME" ];
then
    echo "Installing dependencies for $KUZZLE_PLUGIN_NAME"
    cd "$plugins_dir/$KUZZLE_PLUGIN_NAME"

    npm ci --unsafe-perm --force

    # This is dirty but we are in a development environment, who cares
    chmod 777 node_modules/
    cd "$working_dir"
else
  for target in ${plugins_dir}/* ; do
    if [ -d "$target" ]; then
      echo 'Installing dependencies for ' $(basename "$target")
      cd "$target"

      npm ci --unsafe-perm --force

      # This is dirty but we are in a development environment, who cares
      chmod 777 node_modules/
      cd "$working_dir"
    fi
  done
fi

cd /var/app

nodemon \
    --inspect=0.0.0.0:9229 \
    bin/start-kuzzle-server \
    $@
