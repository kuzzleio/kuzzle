#!/usr/bin/env bash
#
# Installs the external Elasticsearch 9 driver (ADR-0003 step 05) as an
# application would, into .ci/storage-driver-es9/node_modules, which
# .ci/test-cluster-es9-driver.yml mounts at /node_modules on every Kuzzle node.
#
# Usage: .ci/scripts/stage-es9-driver.sh [npm spec, default @kuzzleio/storage-es-9@beta]
#
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
STAGE="$ROOT_DIR/.ci/storage-driver-es9"
SPEC="${1:-@kuzzleio/storage-es-9@beta}"

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
node -e '
  const fs = require("fs");
  const file = "node_modules/@kuzzleio/storage-es-9/manifest.json";
  const manifest = JSON.parse(fs.readFileSync(file, "utf8"));
  manifest.kuzzleVersion = "*";
  fs.writeFileSync(file, JSON.stringify(manifest, null, 2));
'

echo "Staged $(node -p 'require("./node_modules/@kuzzleio/storage-es-9/package.json").version') in $STAGE"
