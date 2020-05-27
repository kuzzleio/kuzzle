#!/bin/sh

source /promises.sh

init_promises "strict"

cd /everest

files=$(ls -I app.tar.xz *.tar.xz)

echo "[ℹ] Decompressing system.."
for file in $files;
do
  basename="${file%.tar.xz}"

  promise_run tar xf $file
    promise_then cp -r $basename/* /$basename/.
done

echo "[ℹ] Decompressing Kuzzle.."

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
