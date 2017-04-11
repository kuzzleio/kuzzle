'use strict';

/**
 * Updates the matched filters according to the provided data
 * O(n) with n the number of values to be tested against document fields
 *
 * @param {object} storage - content of all conditions to be tested
 * @param {object} testTables - test tables to update when a filter matches the document
 * @param {object} document
 */
function MatchNotRegexp (storage, testTables, document) {
  let i;
  for (i = 0; i < storage.keys.array.length; i++) {
    const field = storage.keys.array[i];

    let j;
    for (j = 0; j < storage.fields[field].expressions.array.length; j++) {
      if (document[field] === undefined
       || !storage.fields[field].expressions.array[j].regexp.test(document[field])) {
        testTables.addMatch(storage.fields[field].expressions.array[j].subfilters);
      }
    }
  }
}

module.exports = MatchNotRegexp;
