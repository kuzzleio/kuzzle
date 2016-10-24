/**
 * Updates the matched filters according to the provided data
 * O(log n + m) with n the number of values to be tested against document fields,
 * and m the number of approximated shapes to check
 *
 * @param {Object} storage - content of all conditions to be tested
 * @param {Object} testTables - test tables to update when a filter matches the document
 * @param {Object} document
 */
function MatchGeospatial (storage, testTables, document) {
  var i, field;

  for(i = 0; i < storage.keys.array.length; i++) {
    field = storage.keys.array[i];

    if (document[field]) {
      let
        result = storage.custom.index.queryPoint(document[field].lat, document[field].lon),
        j;

      for(j = 0; j < result.length; j++) {
        testTables.addMatch(storage.fields[field][result[j]]);
      }
    }
  }
}

module.exports = MatchGeospatial;
