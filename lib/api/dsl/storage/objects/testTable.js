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

const SortedArray = require('sorted-array');

/**
 * Creates a test table entry. Mutates the provided subfilter object
 * and its associated filters, in order to update their index
 * references.
 *
 * This allows V8 to convert this object to a pure
 * C++ class, with direct access to its members,
 * instead of a dictionary with b-search access time
 *
 * @class TestTable
 * @param {object} subfilter
 * @constructor
 */
class TestTable {
  constructor(subfilter) {
    this.clength = 0;
    this.conditions = new Uint8Array(10);
    this.removedConditions = new SortedArray([]);
    this.removedFilters = {};
    this.removedFiltersCount = 0;
    this.reindexing = false;

    this.conditions[this.clength] = subfilter.conditions.length;
    this.clength++;
    this.filtersCount = subfilter.filters.length;

    subfilter.cidx = 0;
    subfilter.filters.forEach((f, i) => {
      f.fidx = i;
    });
  }

  /**
   * Adds a subfilter to this test table. Mutates the provided subfilter object.
   * @param subfilter
   */
  addSubfilter(subfilter) {
    if (subfilter.cidx === -1) {
      subfilter.cidx = this.clength;

      if (this.clength >= this.conditions.length) {
        const tmp = new Uint8Array(this.clength + Math.floor(this.clength / 2));
        tmp.set(this.conditions, 0);
        this.conditions = tmp;
      }

      this.conditions[this.clength] = subfilter.conditions.length;
      this.clength++;

      subfilter.filters.forEach(f => {
        if (f.fidx === -1) {
          f.fidx = this.filtersCount;
          this.filtersCount++;
        }
      });
    }
  }
}

/**
 * @type {TestTable}
 */
module.exports = TestTable;
