#!/bin/sh

for dir in ./*/; do
    echo ""
    echo ""
    echo "$dir"

    sh build.sh "$dir"
done