#! /bin/bash

set -e

echo "Checking error codes..."

TMPDIR=$TRAVIS_BUILD_DIR/codes

mkdir $TMPDIR

npm run doc-error-codes -- --output $TMPDIR

for f in doc/2/api/essentials/error-codes/*
do
  if [ -d "$f" ]; then
    diff $f $TMPDIR/$(basename $f)
  fi
done
