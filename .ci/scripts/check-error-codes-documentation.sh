#! /bin/bash

set -e

echo "Checking error codes..."

mkdir $TRAVIS_BUILD_DIR/codes

npm run doc-error-codes -- --output $TRAVIS_BUILD_DIR

for f in doc/2/api/essentials/codes/*
do
  if [ -d "$f" ]; then
    diff $f ~/tmp/codes/$(basename $f)
  fi
done
