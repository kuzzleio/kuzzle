/**
 * Setup file (`vitest.conformance.config.ts`): the built-in driver packages
 * get the checkout's Kuzzle from `require("kuzzle")`, the same instance the
 * conformance kit runs with.
 *
 * In production, provideRunningKuzzle finds the running Kuzzle in Node's
 * module cache. Under vitest, the checkout is loaded by vitest, not by Node:
 * it is put in Node's cache here, under a file name of its own, and the
 * packages' `require("kuzzle")` resolves to it, whether npm installed a copy
 * of Kuzzle for them (a required peer dependency until kuzzle-storage-es-7/8
 * 1.2.0-beta.2) or not.
 */
import { createRequire, Module } from "node:module";
import * as path from "node:path";

import * as kuzzle from "../../index";

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
const filename = path.join(__dirname, "running-kuzzle.js");
const running = new Module(filename);

running.filename = filename;
running.loaded = true;
running.exports = kuzzle;
nodeRequire.cache[filename] = running;

const resolve: ResolveFilename = Reflect.get(Module, "_resolveFilename");

Reflect.set(
  Module,
  "_resolveFilename",
  function resolveRunningKuzzle(
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
      return filename;
    }

    return resolve.call(this, request, parent, ...rest);
  },
);
