#!/usr/bin/env bash
#
# Smoke check for `npm run build`'s payload.
#
# `tsc` emits the compiled JavaScript, and `bin/copy-binaries.ts` copies in what
# the compiler does not: the cluster's `.proto` definitions and the executable
# server entrypoint. Nothing used to assert that second half ran — and its
# failure mode is a *published package silently missing its `.proto` files*,
# which only surfaces when a cluster node boots. So assert it here, on both the
# PR workflow and the release workflow.
#
# Every path below is one that `package.json`'s `files` list promises to ship.

set -euo pipefail

cd "$(dirname "$0")/../.."

expected_files=(
  "dist/index.js"
  "dist/lib/kuzzle/kuzzle.js"
  "dist/lib/cluster/protobuf/command.proto"
  "dist/lib/cluster/protobuf/sync.proto"
  "dist/bin/copy-binaries.js"
  "dist/bin/start-kuzzle-server"
)

failed=0

for file in "${expected_files[@]}"; do
  if [ -f "$file" ]; then
    echo "✅ $file"
  else
    echo "❌ MISSING: $file"
    failed=1
  fi
done

# `start-kuzzle-server` is the container's entrypoint: it has to stay executable
# through the copy, which is why copy-binaries chmods it explicitly.
if [ -f "dist/bin/start-kuzzle-server" ] && [ ! -x "dist/bin/start-kuzzle-server" ]; then
  echo "❌ dist/bin/start-kuzzle-server is not executable"
  failed=1
fi

if [ "$failed" -ne 0 ]; then
  echo
  echo "The build payload is incomplete — 'tsc' may have succeeded while"
  echo "bin/copy-binaries.ts did not run. See docs/adr-001/steps/08-type-debt-backlog.md."
  exit 1
fi

echo
echo "✅ build payload complete."
