#!/bin/sh

set -e

/bin/everest-extract

exec "$@"
