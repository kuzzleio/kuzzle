#!/bin/sh

set -e

test -d /everest && /bin/everest-extract

exec "$@"
