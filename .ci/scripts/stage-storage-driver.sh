#!/usr/bin/env bash
#
# Installs an external storage driver (ADR-0003 steps 05 and 07) as an
# application would, into .ci/storage-driver-<name>/node_modules, which
# .ci/test-cluster-<name>-driver.yml mounts at /node_modules on every Kuzzle
# node.
#
# Usage: .ci/scripts/stage-storage-driver.sh <es9|opensearch2|opensearch3> [npm spec]
#   npm spec: default <package>@<the version pinned below>; a local .tgz
#   works too
#
set -euo pipefail

NAME="${1:?usage: stage-storage-driver.sh <es9|opensearch2|opensearch3> [npm spec]}"

# The driver versions Kuzzle's CI runs on, and the only place they are set
# (#3136): exact, so that a driver release cannot change this repository's CI
# on its own. Bump them here, in a pull request of their own.
case "$NAME" in
  es9) PACKAGE=kuzzle-storage-es-9 VERSION=1.0.0 ;;
  opensearch2) PACKAGE=kuzzle-storage-opensearch-2 VERSION=1.0.0-beta.2 ;;
  opensearch3) PACKAGE=kuzzle-storage-opensearch-3 VERSION=1.0.0-beta.2 ;;
  *)
    echo "Unknown storage driver '$NAME' (expected es9, opensearch2 or opensearch3)" >&2
    exit 1
    ;;
esac

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
STAGE="$ROOT_DIR/.ci/storage-driver-$NAME"
SPEC="${2:-$PACKAGE@$VERSION}"

rm -rf "$STAGE"
mkdir -p "$STAGE"
cd "$STAGE"

echo '{ "private": true }' > package.json
# Its peer dependency, `kuzzle`, is the checkout: not installed from npm
npm install --legacy-peer-deps --no-audit --no-fund "$SPEC"
cp -r "$ROOT_DIR/features/fixtures/kuzzle-self" node_modules/kuzzle

# 2-dev keeps the last release's version until the next release, so the
# manifest's `kuzzleVersion` range is opened up here: that check is the
# loader's own, covered by its unit tests.
PACKAGE="$PACKAGE" node -e '
  const fs = require("fs");
  const file = `node_modules/${process.env.PACKAGE}/manifest.json`;
  const manifest = JSON.parse(fs.readFileSync(file, "utf8"));
  manifest.kuzzleVersion = "*";
  fs.writeFileSync(file, JSON.stringify(manifest, null, 2));
'

echo "Staged $PACKAGE@$(node -p "require('./node_modules/$PACKAGE/package.json').version") in $STAGE"
