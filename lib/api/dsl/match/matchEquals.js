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
  var subfilters = [];

  Object.keys(storage).forEach(field => {
    var result, i;

    if (document[field]) {
      result = storage[field].values[document[field]];

      if (result) {
        for(i = 0; i < result.length; i++) {
          testTables.addMatch(result[i]);
        }
      }
    }
  });

  return subfilters;
};
