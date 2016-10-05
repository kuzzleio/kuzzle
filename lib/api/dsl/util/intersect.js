/**
 * Returns the intersection of 2 **SORTED** arrays in O(m+n)
 *
 *
 * @param {Array} a
 * @param {Array} b
 * @param {Function} [comparator]
 * @return {Array}
 */
module.exports = function (a, b, comparator) {
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
};
