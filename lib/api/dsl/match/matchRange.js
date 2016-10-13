/**
 * Updates the matched filters according to the provided data
 *
 * @param {Object} storage - content of all conditions to be tested
 * @param {Object} testTables - test tables to update when a filter matches the document
 * @param {Object} document
 */
module.exports = function (storage, testTables, document) {
  var
    result,
    i;

  storage.keys.forEach(key => {
    var s = storage.fields[key];

    if (document[key]) {
      result = s.tree.search(document[key], document[key]);

      for(i = 0; i < result.length; i++) {
//        testTables.addMatchIndexes(s.cIndexes[result[i]], s.fIndexes[result[i]]);
      }
    }
  });
};
