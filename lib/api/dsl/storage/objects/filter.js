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
 * Creates a Filter object referring to a collection of subfilters
 *
 * This allows V8 to convert this object to a pure
 * C++ class, with direct access to its members,
 * instead of a dictionary with b-search access time
 *
 * @class Filter
 * @type {object}
 * @property {string} id
 * @property {string} index
 * @property {string} collection
 * @property {Array<Array<Object>>} filters in their canonical form
 * @property {Array<Subfilter>} subfilters
 * @property {number} fidx - maps to the filters test table
 *
 * @param {string} id - filter unique id
 * @param {string} index
 * @param {string} collection
 * @param {Array<Array<Object>>} filters
 */
class Filter {
  constructor(id, index, collection, filters) {
    this.id = id;
    this.index = index;
    this.collection = collection;
    this.filters = filters;
    this.subfilters = [];
    this.fidx = -1;
  }
}

module.exports = Filter;
