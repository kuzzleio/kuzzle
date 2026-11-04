/**
 * Setup file (`vitest.config.ts`): what the built-in driver packages get from
 * `require("kuzzle")` in the unit tests.
 *
 * In this repository, npm installs another copy of Kuzzle for that peer
 * dependency, and loading it would replace the checkout's `global.kuzzle`.
 * Under vitest, the checkout is not in Node's module cache for
 * `builtInStorageDriver` to provide it instead (see `builtInDrivers.ts`). The
 * unit tests only load the packages and build native clients, so the packages
 * get a stand-in that fails loudly if a test reaches further.
 */
import { createRequire, Module } from "node:module";
import * as path from "node:path";

const nodeRequire = createRequire(__filename);
const peer = nodeRequire.resolve("kuzzle", {
  paths: [path.dirname(nodeRequire.resolve("kuzzle-storage-es-7"))],
});

const standIn = new Module(peer);

standIn.filename = peer;
standIn.loaded = true;
standIn.exports = new Proxy(
  {},
  {
    get(_target, key) {
      throw new Error(
        `kuzzle.${String(key)} is not available to a driver package in Kuzzle's unit tests`,
      );
    },
  },
);

nodeRequire.cache[peer] = standIn;
