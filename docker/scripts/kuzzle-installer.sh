#!/usr/bin/env sh

set -e

if [ -z "$NODE_VERSION" ];
then
  echo "Missing NODE_VERSION, use default NODE_14_VERSION"
  n "$NODE_14_VERSION"
fi

echo "Installing dependencies"
npm install

if [ -n "$REBUILD" ]; then
  echo "Force C++ deps rebuilding"
  npm rebuild all --unsafe-perm
fi

exit 0
