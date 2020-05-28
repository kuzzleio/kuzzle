#!/bin/sh

set -e

# Remove non-production dependencies
npm prune --production

# Remove useless files
/usr/local/bin/node-prune

# Remove useless files
# @todo remove when https://github.com/tj/node-prune/pull/68 is merged
rm -rf .git/
find . -type d -name "man" | xargs rm -rf
find . -type f \( -name "*.o"  -o -name "*.h" -o -name "package-lock.json" -o -name "*.mk" -o -name "*Makefile*" -o -name "*.c" -o -name "*.cpp" -o -name "*.hpp" \) -exec rm {} \;

# Minify JS & JSON
if [ $NODE_ENV = "production" ];
then
  echo "Minify JS & JSON files"
  for file in $(find . \( -name "*.json" -o -name "*.js" \)); do minify $file -o $file; done
fi