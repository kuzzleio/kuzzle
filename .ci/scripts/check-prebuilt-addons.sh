#!/usr/bin/env bash
#
# Asserts that `npm ci` compiled none of the Kuzzle-maintained native addons.
#
# dumpme, boost-geospatial-index and kuzzle-espresso-logic-minimizer ship
# prebuilt N-API binaries inside their tarballs (#2839), and `node-gyp-build`
# only compiles when none matches the platform. A compile here therefore means
# a regression — a dependency bump back to a version without prebuilds, or a
# platform the prebuilds stopped covering — and it would bring back the
# install-time network download and compiler failures TD-83 retries around.
#
# Checked per addon: the binary node-gyp-build resolves lives under
# `prebuilds/`, and there is no `build/` directory (the output of a local
# compile). re2 is deliberately not checked: it downloads its binary from
# GitHub at install time and compiles when that download fails, so asserting
# on it would turn a network hiccup into a red build.

set -euo pipefail

node - <<'EOF'
const path = require("path");

const addons = [
  "dumpme",
  "boost-geospatial-index",
  "kuzzle-espresso-logic-minimizer",
];
let failed = false;

for (const name of addons) {
  const dir = path.dirname(
    require.resolve(`${name}/package.json`, {
      paths: [require.resolve("koncorde/package.json"), process.cwd()],
    }),
  );
  const binary = require("node-gyp-build").path(dir);
  const compiled = require("fs").existsSync(path.join(dir, "build"));
  const ok = binary.includes(`${path.sep}prebuilds${path.sep}`) && !compiled;

  console.log(`${ok ? "ok  " : "FAIL"} ${name}: ${path.relative(dir, binary)}`);
  failed ||= !ok;
}

if (failed) {
  console.error(
    "A native addon was compiled at install time instead of using its prebuild (see #2839).",
  );
  process.exit(1);
}
EOF
