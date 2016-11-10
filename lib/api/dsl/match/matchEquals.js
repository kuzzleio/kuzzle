'use strict';

/**
 * Updates the matched filters according to the provided data
 * O(log n) with n the number of values to be tested against document fields
 *
 * @param {Object} storage - content of all conditions to be tested
 * @param {Object} testTables - test tables to update when a filter matches the document
 * @param {Object} document
 */
function MatchEquals (storage, testTables, document) {
  var i, field;

  for(i = 0; i < storage.keys.array.length; i++) {
    field = storage.keys.array[i];

    if (document[field] && storage.fields[field][document[field]]) {
      testTables.addMatch(storage.fields[field][document[field]]);
    }
  }
}

module.exports = MatchEquals;
