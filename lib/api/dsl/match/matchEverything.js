'use strict';

/**
 * Updates the matched filters according to the provided data
 * O(1)
 *
 * @param {Object} storage - content of all conditions to be tested
 * @param {Object} testTables - test tables to update when a filter matches the document
 */
function MatchEverything (storage, testTables) {
  testTables.addMatch(storage.fields.all);
}

module.exports = MatchEverything;
