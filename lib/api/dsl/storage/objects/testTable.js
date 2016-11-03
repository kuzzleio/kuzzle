var SortedArray = require('sorted-array');

/**
 * Creates a test table entry. Mutates the provided subfilter object
 * and its associated filters, in order to update their index
 * references.
 *
 * This allows V8 to convert this object to a pure
 * C++ class, with direct access to its members,
 * instead of a dictionary with b-search access time
 *
 * @param {Object} subfilter
 * @constructor
 */
function TestTable (subfilter) {
  this.clength = 0;
  this.conditions = new Uint8Array(10);
  this.removedConditions = new SortedArray([]);
  this.removedFilters = new SortedArray([]);
  this.reindexing = false;

  this.conditions[this.clength++] = subfilter.conditions.length;
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
TestTable.prototype.addSubfilter = function addSubfilter (subfilter) {
  if (subfilter.cidx === -1) {
    subfilter.cidx = this.clength;

    if (this.clength >= this.conditions.length) {
      let tmp = new Uint8Array(this.clength + Math.floor(this.clength / 2));
      tmp.set(this.conditions, 0);
      this.conditions = tmp;
    }

    this.conditions[this.clength++] = subfilter.conditions.length;

    subfilter.filters.forEach(f => {
      if (f.fidx === -1) {
        f.fidx = this.filtersCount++;
      }
    });
  }
};

/**
 * @type {TestTable}
 */
module.exports = TestTable;
