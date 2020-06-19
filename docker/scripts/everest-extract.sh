#!/bin/sh

cd /everest

files=$(ls *.tar.xz | grep -v app.tar.xz)

echo "[ℹ] Decompressing system.."
for file in $files;
do
  dirname="${file%.tar.xz}"
  mkdir -p /$dirname
  tar xf $file && cp -r $dirname/* /$dirname/. &
done

echo "[ℹ] Decompressing Kuzzle.."

tar xf app.tar.xz &

wait

echo "[ℹ] Copying Kuzzle.."
mkdir -p /app
for file in bin config default.config.js lib node_modules package.json; do
  cp -r app/$file ../app/$file &
done

mkdir -p /app/plugins/enabled
mkdir -p /app/plugins/available
cp -r app/plugins/enabled/* ../app/plugins/enabled/. &
cp -r app/plugins/available/* ../app/plugins/available/. &

wait

echo "[✔] System ready"
