#!/bin/sh

set -e

start_promises () {
  promises=0
}

run_promise () {
  local promise=$1
  local lockfile=/tmp/promise_$promises

  test -f $lockfile && rm $lockfile

  $($promise) && touch $lockfile &

  promises=$((promises+1))
}

wait_promises () {
  local resolved=0

  until [ $resolved -eq 2 ]
  do
    resolved=0

    i=0
    while [ $i -ne $promises ]
    do
      test -f /tmp/promise_$i && resolved=$((resolved+1))
      i=$((i+1))
    done

    sleep 0.1
  done
}

if [ -f /everest/system.tar.xz ] && [ -f /everest/app.tar.xz ]; then

    echo "Decompressing system.."
    cd /everest

    tar xf system.tar.xz
    cp -r lib/* ../lib/.
    cp -r usr/* ../usr/.

    echo "Decompressing Kuzzle.."
    cd /everest
    tar xf app.tar.xz

    echo "Copying Kuzzle.."
    mkdir -p /var/app
    for file in bin config default.config.js docker lib node_modules package-lock.json package.json; do
      cp -r var/app/$file ../var/app/$file
    done

    mkdir -p /var/app/plugins/enabled
    mkdir -p /var/app/plugins/available
    cp -r var/app/plugins/available/* ../var/app/plugins/available/.
    cp -r var/app/plugins/enabled/* ../var/app/plugins/enabled/.

else

  echo "Missing /system/system.tar.xz and /everest/app.tar.xz"
  exit 1

fi
