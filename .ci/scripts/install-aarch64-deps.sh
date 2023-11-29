#!/usr/bin/env bash
# WARNING: This script needs to be run in sdk-cross:node8-armhf image
# Install Kuzzle deps using cross build toolchain
npm ci --target_arch=arm64  --target_platform=linux --silent --unsafe-perm \
  --build-from-source=boost-geospatial-index \
  --build-from-source=espresso-logic-minimizer \
  --build-from-source=unix-dgram \
  --build-from-source=uws \
  --build-from-source=murmurhash-native \
  --build-from-source=dumpme \
  --build-from-source=cucumber-expressions
npm ci --only=dev --target_arch=arm64 --target_platfrom=linux --unsafe-perm --silent
