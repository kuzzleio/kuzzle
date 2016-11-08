'use strict';

var
  convertGeopoint = require('../util/convertGeopoint');

/**
 * Updates the matched filters according to the provided data
 * O(log n + m) with n the number of values to be tested against document fields,
 * and m the number of matched shapes
 *
 * @param {Object} storage - content of all conditions to be tested
 * @param {Object} testTables - test tables to update when a filter matches the document
 * @param {Object} document
 */
function MatchNotGeospatial (storage, testTables, document) {
  for(let i = 0; i < storage.keys.array.length; i++) {
    let
      field = storage.keys.array[i],
      ids = storage.fields[field].ids;

    if (document[field]) {
      let
        point = convertGeopoint(document[field]),
        result;

      if (point === null) {
        return;
      }

      result = storage.custom.index.queryPoint(point.lat, point.lon).sort();

      for(let j = 0; j < ids.array.length; j++) {
        if (ids.array[j].id !== result[0]) {
          testTables.addMatch(ids.array[j].subfilters);
        }
        else {
          result.shift();
        }
      }
    }
  }
}

module.exports = MatchNotGeospatial;
