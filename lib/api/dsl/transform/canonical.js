var
  combinatorics = require('js-combinatorics'),
  espresso = require('espresso-logic-minimizer');

/**
 * Converts filters in canonical form
 *
 * @constructor
 */
function Canonical () {
  /**
   * Entry point of the normalizer: takes a filter in, and reduces it
   * into a simplified version
   *
   * Result format:
   *  [
   *    [{condition: {...}, not: <boolean>}, {condition: {...}, not: <boolean>}, ...],
   *    [{condition: {...}, not: <boolean>}, {condition: {...}, not: <boolean>}, ...],
   *    ...
   *  ]
   *
   * Explanation:
   *  Each array entry contains an array of conditions. Each one of these conditions are linked
   *  using a AND operand.
   *  Array entries are linked together with OR operands.
   *
   * @param filters
   * @return {Array} resolving to a simplified filters array
   * @throws if espresso is unable to normalize the provided filters
   */
  this.convert = function (filters) {
    var
      conditions = extractConditions(filters),
      pla = buildPLA(filters, conditions.length),
      normalized = espresso(pla),
      result = [];

    normalized.forEach(entry => {
      var
        i,
        n,
        subresult = [],
        length = entry.length;

      for (i = 0; entry.charAt(i) !== ' ' && i < length; i++) {
        // espresso output character can have the following values: '0', '1' or '-'
        n = parseInt(entry.charAt(i), 2);

        if (!isNaN(n)) {
          // eslint-disable-next-line no-extra-boolean-cast
          conditions[i].not = !(Boolean(n));

          subresult.push(conditions[i]);
        }
      }

      result.push(subresult);
    });

    return result;
  };

  return this;
}

/**
 * Extracts the conditions from a filter set
 *
 * @param {Object} filters
 * @param {Array} [conditions]
 * @return {Array}
 */
function extractConditions (filters, conditions) {
  var key = Object.keys(filters)[0];

  conditions = conditions || [];

  if (['and', 'or', 'not'].indexOf(key) === -1) {
    conditions.push(filters);
    return conditions;
  }

  if (key === 'not') {
    return extractConditions(filters[key], conditions);
  }

  return filters[key].reduce((p, c) => extractConditions(c, p), conditions);
}

/**
 * Builds a truth table calculating all combinatorics
 * of the provided filters, and returns it in PLA format
 *
 * @param {Object} filters
 * @param {Number} count - number of conditions
 * @return {Array} truth table in PLA format
 */
function buildPLA (filters, count) {
  var
    baseTable = combinatorics.baseN([true, false], count).toArray(),
    result = [`.i ${count}`, '.o 1'];

  baseTable.forEach(t => {
    var
      output = evalFilter(filters, t) ? '1' : '0',
      input = t.reduce((p, c) => p + (c ? '1' : '0'), '');

    result.push(`${input} ${output}`);
  });

  result.push('.e');

  return result;
}

/**
 * Given a boolean array containing the conditions results, returns
 * a boolean indicating the whole filter result
 *
 * @param {Object} filters
 * @param {Array} results - condition results, contains booleans
 * @param {Object} [pos] - current condition position
 * @returns {Boolean}
 */
function evalFilter(filters, results, pos) {
  var
    key = Object.keys(filters)[0];

  /*
   * We need to embed our position value, which is a scalar,
   * in an object to be able to pass it by reference.
   * This is needed because we need the filter leaves to
   * update their position.
   */
  pos = pos || {value: 0};

  if (['and', 'or', 'not'].indexOf(key) === -1) {
    return results[pos.value++];
  }

  if (key === 'not') {
    return !evalFilter(filters[key], results, pos);
  }

  return filters[key].reduce((p, c) => {
    var r = evalFilter(c, results, pos);

    if (p === null) {
      return r;
    }

    return key === 'and' ? p && r : p || r;
  }, null);
}


module.exports = Canonical;
