'use strict';

/**
 * Updates the matched filters according to the provided data
 * O(log n + m) with n the number of range filters stored
 * and m the number of matched ranges
 *
 * @param {object} storage - content of all conditions to be tested
 * @param {object} testTables - test tables to update when a filter matches the document
 * @param {object} document
 * @param {boolean} not - used by notrange operator
 */
function MatchRange (storage, testTables, document, not = false) {
  let i;

  for(i = 0; i < storage.keys.array.length; i++) {
    const key = storage.keys.array[i];
    if (document[key] === undefined) {
      if (not) {
        testTables.addMatch(storage.fields[key].tree.search(-Infinity, Infinity));
      }
    }
    else if (typeof document[key] === 'number') {
      testTables.addMatch(storage.fields[key].tree.search(document[key], document[key]));
    }
  }
}

module.exports = MatchRange;
