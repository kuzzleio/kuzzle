var TestTables = require('./testTables');

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
    notequals: require('./matchNotEquals'),
    exists: require('./matchExists'),
    notexists: require('./matchNotExists'),
    range: require('./matchRange'),
    notrange: require('./matchNotRange'),
    regexp: require('./matchRegexp')
  };

  return this;
}

/**
 * Matches data against stored subscriptions
 *
 * @param {string} index
 * @param {string} collection
 * @param {Object} data
 * @return {Array}
 */
Matcher.prototype.match = function match (index, collection, data) {
  var
    operand = null,
    testTables = new TestTables(this.store.testTables, index, collection);

  while ((operand = pickOperand(this.store.foPairs, index, collection, operand)) !== undefined) {
    this.matchers[operand](this.store.foPairs[index][collection][operand], testTables, data);
  }

  return testTables.matched;
};


/**
 * Returns the next operand to be tested, depending
 * on operands prioritization
 *
 * Returns undefined if no other operand is to be tested
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
      'regexp',
      'notregexp'
    ],
    idx = previous ? operands.indexOf(previous) + 1 : 0;

  while(!foPairs[index][collection][operands[idx]] && idx < operands.length) {
    idx++;
  }

  return idx < operands.length ? operands[idx] : undefined;
}

module.exports = Matcher;
