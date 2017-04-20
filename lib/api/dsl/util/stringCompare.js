/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2017 Kuzzle
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
 * Simple string comparison method, following the same
 * behavior than C's strcmp() function.
 * Returns 0 if "a" and "b" are equal, a negative value
 * if a < b, and a positive one if a > b
 *
 * This function avoids making 2 comparisons to
 * determine if a < b, a == b or a > b with the usual JS
 * way of comparing values:
 *   if (a === b) return 0;
 *   return a < b ? -1 : 1;
 *
 * This is usually a premature optimization as the gain
 * is very small. But given the very large number of string
 * comparisons performed, in this very specific case, the
 * performance gain is sizeable.
 *
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
module.exports = function stringCompare(a, b) {
  const min = Math.min(a.length, b.length);

  // Declaring "i" inside the "for" statement downgrades
  // performances by a factor of 3 to 4
  // Should be fixed in later V8 versions
  // (tested on Node 6.9.x)
  let i; // NOSONAR

  for(i = 0; i < min; i++) {
    const r = a.codePointAt(i) - b.codePointAt(i);

    if (r) {
      return r;
    }
  }

  return a.length - b.length;
};
