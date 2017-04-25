/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2017 Kuzzle
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
 * Duplicates reference test tables and keep track of matching
 * subfilters and filters
 *
 * /!\ Critical section: benchmark performances
 * before modifying this object.
 * With large number of matching rooms, the "addMatch" method
 * takes a large proportion of the document-matching time.
 * This might be optimizable by converting this object to a C++ class,
 * avoiding the large number of subsequent V8 type testing/casting
 *
 * @property {Array} matched - matched filters ids
 * @property {Uint8Array} conditions - keep track of matched conditions
 * @property {Uint8Array} filters - keep track of matched filters
 *
 * @class TestTables
 * @param testTablesRef - test tables reference object
 * @param index
 * @param collection
 */
class TestTables {
  constructor(testTablesRef, index, collection) {
    this.conditions = new Uint8Array(testTablesRef[index][collection].conditions);
    this.filters = new Uint8Array(testTablesRef[index][collection].filtersCount);
    this.matched = [];
  }

  /**
   * Registers a matching subfilters in the test tables
   *
   * @param {Array} subfilters - array of matching subfilters
   */
  addMatch(subfilters) {
    // Declaring "i" inside the "for" statement downgrades
    // performances by a factor of 3 to 4
    // Should be fixed in later V8 versions
    // (tested on Node 6.9.x)
    let i; // NOSONAR

    for (i = 0; i < subfilters.length; i++) {
      const sf = subfilters[i];

      if (this.conditions[sf.cidx] > 1) {
        this.conditions[sf.cidx]--;
      }
      else {
        // Declaring "j" inside the "for" statement downgrades
        // performances by a factor of 3 to 4
        // Should be fixed in later V8 versions
        // (tested on Node 6.9.x)
        let j; // NOSONAR
        
        for (j = 0; j < sf.filters.length; j++) {
          const filter = sf.filters[j];

          if (this.filters[filter.fidx] === 0) {
            this.filters[filter.fidx] = 1;
            this.matched.push(filter.id);
          }
        }
      }
    }
  }
}

module.exports = TestTables;
