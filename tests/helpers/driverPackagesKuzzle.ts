/**
 * Setup file (`vitest.config.ts`): what the built-in driver packages get from
 * `require("kuzzle")` in the unit tests.
 *
 * In this repository, npm used to install another copy of Kuzzle for that
 * peer dependency (optional since kuzzle-storage-es-7/8 1.2.0-beta.2), and
 * loading it would replace the checkout's `global.kuzzle`.
 * Under vitest, the checkout is not in Node's module cache for
 * `builtInStorageDriver` to provide it instead (see `builtInDrivers.ts`). The
 * unit tests only load the packages and build native clients, so the packages
 * get a stand-in that fails loudly if a test reaches further.
 */
import { createRequire, Module } from "node:module";
import * as path from "node:path";

type ResolveFilename = (
  request: string,
  parent: NodeJS.Module | undefined,
  ...rest: unknown[]
) => string;

const nodeRequire = createRequire(__filename);
const driverRoots = ["kuzzle-storage-es-7", "kuzzle-storage-es-8"].map(
  (name) =>
    path.dirname(nodeRequire.resolve(`${name}/package.json`)) + path.sep,
);

let peer: string;

try {
  peer = nodeRequire.resolve("kuzzle", { paths: [driverRoots[0]] });
} catch {
  // No copy (the drivers' peer dependency is optional): the packages'
  // `require("kuzzle")` resolves to the stand-in, as provideRunningKuzzle
  // makes it resolve to the running Kuzzle.
  peer = path.join(__dirname, "kuzzle-stand-in.js");

  const resolve: ResolveFilename = Reflect.get(Module, "_resolveFilename");

  Reflect.set(
    Module,
    "_resolveFilename",
    function resolveStandIn(
      this: unknown,
      request: string,
      parent: NodeJS.Module | undefined,
      ...rest: unknown[]
    ): string {
      const from = parent?.filename;

      if (
        request === "kuzzle" &&
        from &&
        driverRoots.some((root) => from.startsWith(root))
      ) {
        return peer;
      }

      return resolve.call(this, request, parent, ...rest);
    },
  );
}

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
