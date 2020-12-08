#! /bin/bash

set -e

echo "Checking error codes.."

TMPDIR=$TRAVIS_BUILD_DIR/codes
mkdir $TMPDIR

cd $TRAVIS_BUILD_DIR
npm run doc-error-codes -- --output $TMPDIR

for f in $TRAVIS_BUILD_DIR/doc/2/api/errors/error-codes/*
do
  if [ -d "$f" ]; then
    diff $f $TMPDIR/$(basename $f)
  fi
done
