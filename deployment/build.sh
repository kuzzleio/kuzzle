#!/bin/sh

usage()
{
    echo "Usage: $0 directory"
    exit 1
}

if [ $# -eq 0 ]; then
    usage
fi

DIR="$1"

if [ -f "$DIR/Dockerfile" ]; then
    if [ ! -f "$DIR/image.sh" ]; then
        echo "no image.sh found in $DIR. Skipping"
        exit 2
    fi

    . "$DIR/image.sh"

    docker build -t "$DOCKER_IMAGE":"$DOCKER_TAG" "$DIR"

else
    echo "No Dockerfile found in $DIR. Skipping"
    exit 2
fi