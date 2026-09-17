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

/*
 * The one `import … = require()` left in `lib/` (TD-49 replaced the other 24
 * with ESM imports): `test/util/didYouMean.test.js` rewires this module and
 * calls `__set__("didYouMean", …)`, which addresses the compiled variable by
 * name. A default import compiles to `didyoumean_1.default` and the stub would
 * silently miss. It goes when that spec moves to vitest.
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
import didYouMean = require("didyoumean");

import "../types/Global";

function printDidYouMean(...args: unknown[]): string {
  if (global.NODE_ENV !== "development") {
    return "";
  }

  const result = didYouMean(...args);

  if (!result) {
    return "";
  }

  return ` Did you mean "${result}"?`;
}

export = printDidYouMean;
