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

const TestTables = require('./testTables');

/**
 * Matches documents or messages against stored subscriptions
 *
 * @class Matcher
 * @param {object} store - DSL storage
 * @constructor
 */
class Matcher {
  constructor(store) {
    this.store = store;
    this.matchers = {
      everything: require('./matchEverything'),
      equals: require('./matchEquals'),
      notequals: require('./matchNotEquals'),
      exists: require('./matchExists'),
      notexists: require('./matchNotExists'),
      range: require('./matchRange'),
      notrange: require('./matchNotRange'),
      regexp: require('./matchRegexp'),
      notregexp: require('./matchNotRegexp'),
      geospatial: require('./matchGeospatial'),
      notgeospatial: require('./matchNotGeospatial')
    };
  }

  /**
   * Matches data against stored subscriptions
   *
   * @param {string} index
   * @param {string} collection
   * @param {object} data
   * @return {Array}
   */
  match(index, collection, data) {
    const testTables = new TestTables(this.store.testTables, index, collection);
    let operand = null;

    while ((operand = pickOperand(this.store.foPairs, index, collection, operand)) !== undefined) {
      this.matchers[operand](this.store.foPairs[index][collection][operand], testTables, data);
    }

    return testTables.matched;
  }
}


/**
 * Returns the next operand to be tested, depending
 * on operands prioritization
 *
 * Returns undefined if no other operand is to be tested
 *
 * @param {object} foPairs
 * @param {string} index
 * @param {string} collection
 * @param {string} [previous] - previous operand picked, if any
 * @return {String|undefined}
 */
function pickOperand(foPairs, index, collection, previous) {
  const
    operands = [
      'everything',
      'equals',
      'exists',
      'notexists',
      'geospatial',
      'notgeospatial',
      'range',
      'notrange',
      'notequals',
      'regexp',
      'notregexp'
    ];
  let idx = previous ? operands.indexOf(previous) + 1 : 0;

  while(!foPairs[index][collection][operands[idx]] && idx < operands.length) {
    idx++;
  }

  return idx < operands.length ? operands[idx] : undefined;
}

module.exports = Matcher;
