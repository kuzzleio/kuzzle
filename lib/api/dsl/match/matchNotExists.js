var strcmp = require('../util/stringCompare');

/**
 * Updates the matched filters according to the provided data
 * O(n + m) with n the number of document keys and m the number of fields to test
 *
 * @param {Object} storage - content of all conditions to be tested
 * @param {Object} testTables - test tables to update when a filter matches the document
 * @param {Object} document
 */
function MatchNotExists (storage, testTables, document) {
  var
    documentKeys = Object.keys(document).sort(),
    comp,
    iStorage = 0,
    iDKeys = 0;

  while (iStorage < storage.keys.array.length && iDKeys < documentKeys.length) {
    comp = strcmp(storage.keys.array[iStorage], documentKeys[iDKeys]);

    if (comp === 0) {
      iStorage++;
      iDKeys++;
    }
    else if (comp < 0) {
      testTables.addMatch(storage.fields[storage.keys.array[iStorage]]);
      iStorage++;
    }
    else {
      iDKeys++;
    }
  }

  // Adding the remaining tested fields to the matched "field not exist" subfilters
  for(;iStorage < storage.keys.array.length; iStorage++) {
    testTables.addMatch(storage.fields[storage.keys.array[iStorage]]);
  }
}

module.exports = MatchNotExists;
