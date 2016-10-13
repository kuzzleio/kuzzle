/**
 * Updates the matched filters according to the provided data
 *
 * @param {Object} storage - content of all conditions to be tested
 * @param {Object} testTables - test tables to update when a filter matches the document
 * @param {Object} document
 */
module.exports = function (storage, testTables, document) {
  Object.keys(storage).forEach(field => {
    var i;

    if (document[field]) {
      if (storage[field].values[document[field]]) {
        for(i = 0; i < storage[field].values[document[field]].length; i++) {
          testTables.addMatchIndexes(storage[field].values[document[field]][i].cidx, storage[field].values[document[field]][i].fidx);
        }
      }
    }
  });
};
