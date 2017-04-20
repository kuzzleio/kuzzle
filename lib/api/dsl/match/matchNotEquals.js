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
 * O(log n) with n the number of values to be tested against document fields
 *
 * @param {object} storage - content of all conditions to be tested
 * @param {object} testTables - test tables to update when a filter matches the document
 * @param {object} document
 */
function MatchNotEquals (storage, testTables, document) {
  // Declaring "i" inside the "for" statement downgrades
  // performances by a factor of 3 to 4
  // Should be fixed in later V8 versions
  // (tested on Node 6.9.x)
  let i; // NOSONAR

  for(i = 0; i < storage.keys.array.length; i++) {
    const field = storage.keys.array[i];

    /*
      If a field is missing, then we match all registered "not equals"
      filters
     */
    let idx = -1;
    if (document[field] !== undefined) {
      idx = storage.fields[field].values.search({value: document[field]});
    }

    // Declaring "j" inside the "for" statement downgrades
    // performances by a factor of 3 to 4
    // Should be fixed in later V8 versions
    // (tested on Node 6.9.x)
    let j; // NOSONAR

    for(j = 0; j < storage.fields[field].values.array.length; j++) {
      if (j !== idx) {
        testTables.addMatch(storage.fields[field].values.array[j].subfilters);
      }
    }
  }
}

module.exports = MatchNotEquals;
