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
 * Creates a Subfilter object referring to a collection of filters and conditions
 *
 * This allows V8 to convert this object to a pure
 * C++ class, with direct access to its members,
 * instead of a dictionary with b-search access time
 *
 * @class Subfilter
 * @type {object}
 * @property {string} id
 * @property {Array<Filter>} filters
 * @property {Array<Condition>} conditions
 * @property {number} cidx - maps to the condition counts test table
 *
 * @param {string} id - subfilter unique id
 * @param {Filter} filter - filter referring to this subfilter
 */
class Subfilter {
  constructor(id, filter) {
    this.id = id;
    this.filters = [filter];
    this.conditions = [];
    this.cidx = -1;
  }
}

module.exports = Subfilter;
