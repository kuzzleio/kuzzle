'use strict';

/**
 * Updates the matched filters according to the provided data
 * O(log n) with n the number of values to be tested against document fields
 *
 * @param {object} storage - content of all conditions to be tested
 * @param {object} testTables - test tables to update when a filter matches the document
 * @param {object} document
 */
function MatchNotEquals (storage, testTables, document) {
  var
    i,
    j,
    field,
    idx = -1;

  for(i = 0; i < storage.keys.array.length; i++) {
    field = storage.keys.array[i];

    /*
      If a field is missing, then we match all registered "not equals"
      filters
     */
    if (document[field]) {
      idx = storage.fields[field].values.search({value: document[field]});
    }

    for(j = 0; j < storage.fields[field].values.array.length; j++) {
      if (j !== idx) {
        testTables.addMatch(storage.fields[field].values.array[j].subfilters);
      }
    }
  }
}

module.exports = MatchNotEquals;
