var
  _ = require('lodash'),
  TestTables = require('./testTables');

/**
 * Matches documents or messages against stored subscriptions
 *
 * @param {Object} store - DSL storage
 * @constructor
 */
function Matcher (store) {
  this.store = store;
  this.matchers = {
    everything: require('./matchEverything'),
    equals: require('./matchEquals'),
    exists: require('./matchExists'),
    notexists: require('./matchNotExists'),
    range: require('./matchRange')
  };

  /**
   * Matches data against stored subscriptions
   *
   * @param {string} index
   * @param {string} collection
   * @param {Object} data
   * @return {Array}
   */
  this.match = function (index, collection, data) {
    var
      lastOperand = null,
      testTables = new TestTables(this.store.testTables, index, collection);

    while ((lastOperand = pickOperand(this.store.foPairs, index, collection, lastOperand)) !== undefined) {
      this.matchers[lastOperand](this.store.foPairs[index][collection][lastOperand], testTables, data);
    }

    //testTables.matched.length = testTables.count;
    return testTables.matched;
  };

  return this;
}


/**
 * Returns the next operand to be tested, depending
 * on operands prioritization
 *
 * Returns undefined if no other operand is to be tested
 *
 * Does not return "regex" nor "notregex". As this keyword cannot
 * be tested using set logic, they are treated separately
 *
 * @param {Object} foPairs
 * @param {String} index
 * @param {String} collection
 * @param {String} [previous] - previous operand picked, if any
 * @return {String|undefined}
 */
function pickOperand(foPairs, index, collection, previous) {
  var
    operands = [
      'everything',
      'equals',
      'exists',
      'notexists',
      /*
       'geoBoundingBox',
       'geoDistance',
       'geoDistanceRange',
       'geoPolygon',
       */
      'range',
      'notrange',
      'notequals',
      /*
       'notgeoBoundingBox',
       'notgeoDistance',
       'notgeoDistanceRange',
       'notgeoPolygon',
       */
    ],
    idx = previous ? operands.indexOf(previous) + 1 : 0;

  while(!foPairs[index][collection][operands[idx]] && idx < operands.length) {
    idx++;
  }

  return idx < operands.length ? operands[idx] : undefined;
}

module.exports = Matcher;
