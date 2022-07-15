#!/usr/bin/env sh

set -e

# Remove non-production dependencies
npm prune --production

# Remove useless files
# @todo remove when https://github.com/tj/node-prune/pull/68 is merged
rm -rf .git/
find . -type d -name "man" | xargs rm -rf
find . -type f \( -name "*.o"  -o -name "*.h" -o -name "npm-shrinkwrap.json" -o -name "*.mk" -o -name "*Makefile*" -o -name "*.c" -o -name "*.cpp" -o -name "*.hpp" \) -exec rm {} \;

# Minify JS & JSON
# I wasn't able to find a portable way to do string comparison with if
( echo $NODE_ENV | grep production ) || exit 0
