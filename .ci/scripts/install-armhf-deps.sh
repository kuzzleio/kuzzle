#!/usr/bin/env bash
# WARNING: This script needs to be run in sdk-cross:node8-armhf image
# Install Kuzzle deps using cross build toolchain
npm install --target_arch=arm  --target_platform=linux --silent --unsafe-perm \
  --build-from-source=boost-geospatial-index \
  --build-from-source=espresso-logic-minimizer \
  --build-from-source=unix-dgram \
  --build-from-source=uws \
  --build-from-source=murmurhash-native \
  --build-from-source=dumpme \
  --build-from-source=cucumber-expressions
npm install --only=dev --target_arch=arm --target_platfrom=linux --unsafe-perm --silent

# Install Plugin logger deps using cross build toolchain
cd plugins/enabled/kuzzle-plugin-logger
npm install --silent --unsafe-perm --target_arch=arm --target_platform=linux \
  --build-from-source=unix-dgram \
  --build-from-source=sinon
cd -

# Install Plugin auth passport deps using cross build toolchain
cd plugins/enabled/kuzzle-plugin-auth-passport-local
npm install --silent --unsafe-perm --target_arch=arm --target_platform=linux
cd -
