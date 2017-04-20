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

const strcmp = require('../util/stringCompare');

/**
 * Updates the matched filters according to the provided data
 * O(min(n,m)) with n the number of document keys and m the number of fields to test
 *
 * @param {object} storage - content of all conditions to be tested
 * @param {object} testTables - test tables to update when a filter matches the document
 * @param {object} document
 */
function MatchExists (storage, testTables, document) {
  const documentKeys = Object.keys(document).sort();
  let
    iStorage = 0,
    iDKeys = 0;

  while (iStorage < storage.keys.array.length && iDKeys < documentKeys.length) {
    const comp = strcmp(storage.keys.array[iStorage], documentKeys[iDKeys]);

    if (comp === 0) {
      testTables.addMatch(storage.fields[storage.keys.array[iStorage]]);
      iStorage++;
      iDKeys++;
    }
    else if (comp < 0) {
      iStorage++;
    }
    else {
      iDKeys++;
    }
  }
}

module.exports = MatchExists;
