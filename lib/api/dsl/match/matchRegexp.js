'use strict';

/**
 * Updates the matched filters according to the provided data
 * O(n) with n the number of values to be tested against document fields
 *
 * @param {object} storage - content of all conditions to be tested
 * @param {object} testTables - test tables to update when a filter matches the document
 * @param {object} document
 */
function MatchRegexp (storage, testTables, document) {
  for(let i = 0; i < storage.keys.array.length; i++) {
    const field = storage.keys.array[i];

    if (document[field]) {
      for (let j = 0; j < storage.fields[field].expressions.array.length; j++) {
        if (storage.fields[field].expressions.array[j].regexp.test(document[field])) {
          testTables.addMatch(storage.fields[field].expressions.array[j].subfilters);
        }
      }
    }
  }
}

module.exports = MatchRegexp;
