var strcmp = require('../util/stringCompare');

/**
 * Updates the matched filters according to the provided data
 *
 * @param {Object} storage - content of all conditions to be tested
 * @param {Object} testTables - test tables to update when a filter matches the document
 * @param {Object} document
 */
module.exports = function (storage, testTables, document) {
  var
    documentKeys = Object.keys(document).sort(),
    i,
    comp,
    iStorage = 0,
    iDKeys = 0;

  while (iStorage < storage.keys.array.length && iDKeys < documentKeys.length) {
    comp = strcmp(storage.keys.array[iStorage], documentKeys[iDKeys]);

    if (comp === 0) {
      for(i = 0; i < storage.fields[storage.keys.array[iStorage]].cidx.length; i++) {
        testTables.addMatchIndexes(storage.fields[storage.keys.array[iStorage]].cidx[i], storage.fields[storage.keys.array[iStorage]].fidx[i]);
      }

      iStorage++;
      iDKeys++;
    }
    else if (comp < 0) {
      iStorage++;
    }
    else {
      iDKeys++;
    }
  }
};
