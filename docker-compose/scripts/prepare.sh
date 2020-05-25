#!/bin/sh

set -e

if [ -f /system/system.tar.xz ]; then

    echo "Decompressing system.."
    cd /system
    tar xf system.tar.xz
    cp -r lib/* ../lib/.
    cp -r usr/* ../usr/.

    echo "Copying Kuzzle.."
    for file in bin config default.config.js docker-compose lib node_modules package-lock.json package.json; do
      cp -r var/app/$file ../var/app/$file
    done
    mkdir -p ../var/app/plugins/enabled
    mkdir -p ../var/app/plugins/available
    cp -r var/app/plugins/available/* ../var/app/plugins/available/.
    cp -r var/app/plugins/enabled/* ../var/app/plugins/enabled/.

else

  echo "Missing /system/system.tar.xz"
  exit 1

fi
