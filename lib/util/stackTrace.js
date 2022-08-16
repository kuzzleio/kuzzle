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

"use strict";

const util = require("util");

const MARKER = ">";
const PADDING = "  ";

/**
 * Hilight user code
 *
 * e.g.
 *       at BackendController._add (/home/kuzzle/lib/core/application/backend.ts:261:28)
 *       at BackendController.register (/home/kuzzle/lib/core/application/backend.ts:187:10)
 * >>>>  at registerFoo (/home/aschen/projets/app/test.ts:12:18)
 * >>>>  at init (/home/aschen/projets/app/test.ts:8:3)
 *       at Module._compile (internal/modules/cjs/loader.js:1133:30)
 */
function hilightUserCode(line) {
  // ignore first line (error message) or already enhanced
  if (!line.includes(" at ") || line.startsWith(MARKER)) {
    return line;
  }

  const isKuzzleCode = line.includes("kuzzle/lib/");
  const isNodeCode =
    !line.includes("at /") &&
    !line.includes("at async /") &&
    line.charAt(line.indexOf("(") + 1) !== "/";
  const isModuleCode = line.includes("node_modules");
  if (isKuzzleCode || isNodeCode || isModuleCode) {
    return PADDING + line;
  }

  // hilight user code
  return MARKER + line;
}

/**
 * utility method: must be invoked by all protocols to remove stack traces
 * from payloads before sending them
 * @param  {Error|Object} data - expected: plain error object or serialized
 *                               request response
 * @returns {*} return the data minus the stack trace
 */
function removeStacktrace(data) {
  if (util.types.isNativeError(data)) {
    if (global.NODE_ENV !== "development") {
      data.stack = undefined;
    } else {
      data.stack = data.stack.split("\n").map(hilightUserCode).join("\n");
    }
  } else if (data && data.content && data.content.error) {
    // @todo v3: stack should be removed only for "production" env
    if (global.NODE_ENV !== "development") {
      data.content.error.stack = undefined;
    } else {
      data.content.error.stack = data.content.error.stack
        ? data.content.error.stack.split("\n").map(hilightUserCode).join("\n")
        : undefined;
    }
  }

  return data;
}

module.exports = {
  hilightUserCode,
  removeStacktrace,
};
