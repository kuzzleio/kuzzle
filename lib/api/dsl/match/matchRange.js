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
 * Updates the matched filters according to the provided data
 * O(log n + m) with n the number of range filters stored
 * and m the number of matched ranges
 *
 * @param {object} storage - content of all conditions to be tested
 * @param {object} testTables - test tables to update when a filter matches the document
 * @param {object} document
 * @param {boolean} not - used by notrange operator
 */
function MatchRange (storage, testTables, document, not = false) {
  // Declaring "i" inside the "for" statement downgrades
  // performances by a factor of 3 to 4
  // Should be fixed in later V8 versions
  // (tested on Node 6.9.x)
  let i; // NOSONAR

  for(i = 0; i < storage.keys.array.length; i++) {
    const key = storage.keys.array[i];
    if (document[key] === undefined) {
      if (not) {
        testTables.addMatch(storage.fields[key].tree.search(-Infinity, Infinity));
      }
    }
    else if (typeof document[key] === 'number') {
      testTables.addMatch(storage.fields[key].tree.search(document[key], document[key]));
    }
  }
}

module.exports = MatchRange;
