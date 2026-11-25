/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2026 Kuzzle
 * mailto: support AT kuzzle.io
 * website: http://kuzzle.io
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// What loading a storage driver package takes, built-in or external alike
// (ADR-0003 steps 03 and 06).

import * as fs from "node:fs";
import Module from "node:module";
import * as path from "node:path";

/**
 * A driver package requires `kuzzle`, a peer dependency. In an application,
 * that is the running Kuzzle. When Kuzzle is itself the application (its
 * repository, its Docker image), npm installs another copy of `kuzzle` for
 * that peer dependency, and a driver installed from a directory resolves
 * the one of that directory: their error classes are not the ones the running
 * Kuzzle checks against. The running Kuzzle is put in that copy's place,
 * before the driver loads.
 *
 * When the driver resolves no `kuzzle` at all (Kuzzle is the application and
 * npm installed no copy: the peer dependency is optional), its
 * `require("kuzzle")` is made to resolve to the running Kuzzle.
 *
 * Nothing to do when the driver resolves a `kuzzle` already loaded: the
 * running Kuzzle itself, in an application.
 *
 * @param driverEntry - The driver package's resolved entry point
 */
export function provideRunningKuzzle(driverEntry: string): void {
  // `index.js` once built, `index.ts` when run from the sources
  const entry = path.join(__dirname, "../../../index");
  const running = require.cache[`${entry}.js`] ?? require.cache[`${entry}.ts`];
  let peer: string;

  try {
    peer = require.resolve("kuzzle", {
      paths: [path.dirname(driverEntry)],
    });
  } catch {
    if (running) {
      resolveKuzzleFrom(packageRoot(driverEntry), running.filename);
    }
    return;
  }

  // Under vitest, Kuzzle is not in Node's module cache: nothing to provide
  if (running && require.cache[peer] === undefined) {
    require.cache[peer] = running;
  }
}

type ResolveFilename = (
  request: string,
  parent: NodeJS.Module | undefined,
  ...rest: unknown[]
) => string;

const kuzzleless: string[] = [];
let runningKuzzle: string | undefined;

/**
 * Makes `require("kuzzle")`, from the files of a package that cannot resolve
 * it, resolve to the running Kuzzle's entry point, which Node's cache holds.
 */
function resolveKuzzleFrom(root: string, running: string): void {
  runningKuzzle = running;

  if (kuzzleless.includes(root)) {
    return;
  }

  kuzzleless.push(root);

  if (kuzzleless.length > 1) {
    return;
  }

  // Node's internal resolver, the hook point of module aliasing
  const resolve: ResolveFilename = Reflect.get(Module, "_resolveFilename");

  function resolveRunningKuzzle(
    this: unknown,
    request: string,
    parent: NodeJS.Module | undefined,
    ...rest: unknown[]
  ): string {
    const from = parent?.filename;

    if (
      request === "kuzzle" &&
      runningKuzzle &&
      from &&
      kuzzleless.some((dir) => from.startsWith(dir))
    ) {
      try {
        return resolve.call(this, request, parent, ...rest);
      } catch {
        return runningKuzzle;
      }
    }

    return resolve.call(this, request, parent, ...rest);
  }

  Reflect.set(Module, "_resolveFilename", resolveRunningKuzzle);
}

/**
 * The directory of the package a file belongs to, with a trailing separator
 */
function packageRoot(file: string): string {
  // Real path: the one Node gives the requiring module
  let dir = path.dirname(fs.realpathSync(file));

  while (!fs.existsSync(path.join(dir, "package.json"))) {
    const parent = path.dirname(dir);

    if (parent === dir) {
      return path.dirname(fs.realpathSync(file)) + path.sep;
    }

    dir = parent;
  }

  return dir + path.sep;
}

/**
 * Why a driver package cannot be resolved, without Node's `Require stack`,
 * and how to install it.
 */
export function notFoundDetail(name: string, error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);

  return `${message.split("\n")[0]}. Install it next to kuzzle: npm install ${name}`;
}
