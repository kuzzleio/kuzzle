#!/bin/bash

for dir in ./*/; do
    echo ""
    echo ""
    echo "$dir"

    bash build.sh "$dir"
done