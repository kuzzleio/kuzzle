/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2020 Kuzzle
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

'use strict';

/**
  * Hilight user code
  *
  * e.g.
  *     at BackendController._add (/home/kuzzle/lib/core/application/backend.ts:261:28)
  *     at BackendController.register (/home/kuzzle/lib/core/application/backend.ts:187:10)
  * >  at registerFoo (/home/aschen/projets/app/test.ts:12:18)
  * >  at init (/home/aschen/projets/app/test.ts:8:3)
  *     at Module._compile (internal/modules/cjs/loader.js:1133:30)
  */
function hilightUserCode (line) {
  console.log(line);
  // ignore first line (error message) or already enhanced
  if (! line.includes(' at ') || line.startsWith('>')) {
    console.log(0)
    return line;
  }

  if ( line.includes('kuzzle/lib/') // ignore kuzzle code
    || (line.indexOf('at /') === -1 && line.indexOf('at async /') === -1 && line.charAt(line.indexOf('(') + 1) !== '/') // ignore node internal
    || line.includes('node_modules') // ignore dependencies
  ) {
    console.log(1)
    return '   ' + line;
  }

  // hilight user code
  console.log(2)
  return '>' + line;
}

module.exports = {
  hilightUserCode,
};
