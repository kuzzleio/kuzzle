/* eslint-disable no-console */

"use strict";

const semver = require("semver");
const { engines } = require("../package.json");

const version = engines.node;
const nodeVersion = process.version;

if (!semver.satisfies(nodeVersion, version)) {
  console.error(
    "\x1b[31m%s\x1b[0m",
    `Required node version ${version} not satisfied with current version ${nodeVersion}`,
  );
  process.exit(1);
}
