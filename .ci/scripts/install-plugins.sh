#!/usr/bin/env bash

set -e
set -x

working_dir=$(pwd)
plugins_dir="plugins/enabled"
protocols_dir="protocols/enabled"

cd "$working_dir"

# npm install plugins
for target in ${plugins_dir}/* ${protocols_dir}/* ; do
  if [ -d "$target" ]; then
    echo 'Installing dependencies for ' $(basename "$target")
    cd "$target"
    npm install --silent --unsafe-perm
    chmod -R 777 node_modules/
    cd "$working_dir"
  fi
done
