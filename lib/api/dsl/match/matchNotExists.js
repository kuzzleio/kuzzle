/**
 * Returns the matching subfilters corresponding
 * to the <f,o> pairs structure and the provided data
 *
 * @param {Object} storage - content of all conditions to be tested
 * @param {Object} testTables - test tables to update when a filter matches the document
 * @param {Object} document
 * @return {Array}
 */
module.exports = function (storage, testTables, document) {
  var
    documentKeys = Object.keys(document).sort(),
    i,
    iStorage = 0,
    iDKeys = 0;

  while (iStorage < storage.mapping.array.length && iDKeys < documentKeys.length) {
    if (storage.mapping.array[iStorage].field === documentKeys[iDKeys]) {
      iStorage++;
      iDKeys++;
    }
    else if (storage.mapping.array[iStorage].field < documentKeys[iDKeys]) {
      for(i = 0; i < storage.mapping.array[iStorage].subfilters.length; i++) {
        testTables.addMatch(storage.mapping.array[iStorage].subfilters[i]);
      }
      iStorage++;
    }
    else {
      iDKeys++;
    }
  }

  // Adding the remaining tested fields to the matched "field not exist" subfilters
  for(;iStorage < storage.mapping.array.length; iStorage++) {
    for(i = 0; i < storage.mapping.array[iStorage].subfilters.length; i++) {
      testTables.addMatch(storage.mapping.array[iStorage].subfilters[i]);
    }
  }
};
