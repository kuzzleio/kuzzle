'use strict';

/**
 * Updates the matched filters according to the provided data
 * O(log n + m) with n the number of range filters stored
 * and m the number of matched ranges
 *
 * @param {object} storage - content of all conditions to be tested
 * @param {object} testTables - test tables to update when a filter matches the document
 * @param {object} document
 */
function MatchRange (storage, testTables, document) {
  var key, i;

  for(i = 0; i < storage.keys.array.length; i++) {
    key = storage.keys.array[i];
    if (document[key] && typeof document[key] === 'number') {
      testTables.addMatch(storage.fields[key].tree.search(document[key], document[key]));
    }
  }
}

module.exports = MatchRange;
