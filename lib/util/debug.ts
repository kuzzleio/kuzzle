/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2022 Kuzzle
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

import * as util from "node:util";

import debug from "debug";

import "../types/Global";

debug.formatters.a = (value) => {
  const inspectOpts = debug.inspectOpts;

  if (inspectOpts.expand) {
    return `\n${util.inspect(value, inspectOpts)}`;
  }

  // Collapse whitespace runs that contain a newline into a single space,
  // leaving newline-free whitespace untouched. A single `\s+` scan with a
  // predicate avoids the super-linear backtracking of `\s*\n\s*`.
  return util
    .inspect(value, inspectOpts)
    .replace(/\s+/g, (match) => (match.includes("\n") ? " " : match));
};

debug.formatArgs = () => {};

function createDebug(namespace: string) {
  const myDebug = debug(namespace);

  myDebug.log = (...args) => {
    if (!["debug", "trace"].includes(global.kuzzle.log.level)) {
      global.kuzzle.log.level = "debug";
    }
    global.kuzzle.log.debug({ namespace }, ...args);
  };

  return myDebug;
}

export = createDebug;
