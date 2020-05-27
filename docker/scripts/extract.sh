#!/bin/sh

source /promises.sh

if [ -f /everest/lib.tar.xz ] && [ -f /everest/usr.tar.xz ] && [ -f /everest/app.tar.xz ]; then
    init_promises "strict"

    echo "[ℹ] Decompressing system.."
    cd /everest

    promise_run tar xf lib.tar.xz
      promise_then cp -r lib/* ../lib/.

    promise_run tar xf usr.tar.xz
      promise_then  cp -r usr/* ../usr/.

    echo "[ℹ] Decompressing Kuzzle.."
    cd /everest
    promise_run tar xf app.tar.xz

    await_promises

    echo "[ℹ] Copying Kuzzle.."
    mkdir -p /var/app
    for file in bin config default.config.js docker lib node_modules package-lock.json package.json; do
      promise_run cp -r var/app/$file ../var/app/$file
    done

    mkdir -p /var/app/plugins/enabled
    mkdir -p /var/app/plugins/available
    promise_run cp -r var/app/plugins/available/* ../var/app/plugins/available/.
    promise_run cp -r var/app/plugins/enabled/* ../var/app/plugins/enabled/.

    await_promises

    echo "[✔] System ready"
else

  echo "[x] Missing /system/system.tar.xz and /everest/app.tar.xz"
  exit 1

fi
