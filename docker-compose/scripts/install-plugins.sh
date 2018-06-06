#!/usr/bin/env bash

working_dir=$(pwd)
plugins_dir="plugins/enabled"
protocols_dir="protocols/enabled"

cd "$working_dir"

# npm install plugins
for target in ${plugins_dir}/* ${protocols_dir}/* ; do
  if [ -d "$target" ]; then
    echo 'Installing dependencies for ' $(basename "$target")
    cd "$target"
    npm install --unsafe-perm
    find -L node_modules/.bin -type f -exec chmod 776 {} \;
    find node_modules/ -type d -exec chmod 755 {} \;
    cd "$working_dir"
  fi
done
