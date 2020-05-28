#!/bin/sh

source /promises.sh

init_promises "strict"

cd /everest

files=$(ls *.tar.xz | grep -v app.tar.xz)

echo "[ℹ] Decompressing system.."
for file in $files;
do
  dirname="${file%.tar.xz}"
  mkdir -p /$dirname
  promise_run tar xf $file
    promise_then cp -r $dirname/* /$dirname/.
done

echo "[ℹ] Decompressing Kuzzle.."

promise_run tar xf app.tar.xz

await_promises

echo "[ℹ] Copying Kuzzle.."
mkdir -p /var/app
for file in bin config default.config.js lib node_modules package.json; do
  promise_run cp -r var/app/$file ../var/app/$file
done

mkdir -p /var/app/plugins/enabled
mkdir -p /var/app/plugins/available
promise_run cp -r var/app/plugins/available/* ../var/app/plugins/available/.
promise_run cp -r var/app/plugins/enabled/* ../var/app/plugins/enabled/.

await_promises

echo "[✔] System ready"
