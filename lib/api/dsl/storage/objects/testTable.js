/**
 * Creates a test table entry. Mutates the provided subfilter object.
 *
 * @param {Object} subfilter
 * @constructor
 */
function TestTable (subfilter) {
  this.conditions = [subfilter.conditions.length];
  this.filtersCount = subfilter.filters.length;

  subfilter.cidx = 0;
  subfilter.filters.forEach((f, i) => {
    f.fidx = i;
  });

  return this;
}

/**
 * Adds a subfilter to this test table. Mutates the provided subfilter object.
 * @param subfilter
 */
TestTable.prototype.addSubfilter = function (subfilter) {
  if (subfilter.cidx === -1) {
    subfilter.cidx = this.conditions.length;
    this.conditions.push(subfilter.conditions.length);

    subfilter.filters.forEach(f => {
      if (f.fidx === -1) {
        f.fidx = this.filtersCount++;
      }
    });
  }
};

module.exports = TestTable;
