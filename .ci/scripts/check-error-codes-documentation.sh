#! /bin/bash

set -e

echo "Checking error codes.."

mkdir codes
npm run doc-error-codes -- --output codes

for f in doc/2/api/errors/error-codes/*
do
  if [ -d "$f" ]; then
    diff $f codes/$(basename $f)
  fi
done
