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
    result = [],
    i,
    fields = intersect(documentKeys, storage.keys.array);

  fields.forEach(f => {
    var field = storage.fields[f];

    for(i = 0; i < field.length; i++) {
      testTables.addMatch(field[i]);
    }
  });

  return result;
};

/**
 * Returns the intersection of 2 SORTED arrays in O(m+n)
 *
 *
 * @param {Array} a
 * @param {Array} b
 * @param {Function} [comparator]
 * @return {Array}
 */
function intersect (a, b, comparator) {
  var
    intersect = [],
    incrA = 0,
    incrB = 0,
    compResult;

  comparator = comparator || function (valA, valB) {
      if (valA === valB) {
        return 0;
      }

      return valA < valB ? -1 : 1;
    };

  while (incrA < a.length && incrB < b.length) {
    compResult = comparator(a[incrA], b[incrB]);
    if (compResult < 0) {
      incrA++;
    }
    else if (compResult > 0) {
      incrB++;
    }
    else {
      intersect.push(a[incrA]);
      incrA++;
      incrB++;
    }
  }

  return intersect;
}
