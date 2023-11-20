#!/usr/bin/env bash

set -ex

working_dir=$(pwd)
plugins_dir="plugins/enabled"
protocols_dir="protocols/enabled"

cd "$working_dir"

for target in ${plugins_dir}/* ${protocols_dir}/* ; do
  if [ -d "$target" ]; then
    echo 'Installing dependencies for ' $(basename "$target")
    cd "$target"
    npm ci --silent --unsafe-perm
    cd "$working_dir"
  fi
done
