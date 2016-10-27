/**
 * Creates a test table entry. Mutates the provided subfilter object.
 *
 * @param {Object} subfilter
 * @constructor
 */
function TestTable (subfilter) {
  this.csize = 10;
  this.clength = 0;
  this.conditions = new Uint8Array(this.csize);

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
    subfilter.cidx = this.conditions.length;

    if (this.clength >= this.csize) {
      let tmp;
      this.csize += Math.floor(this.csize / 2);
      tmp = new Uint8Array(this.csize);
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

module.exports = TestTable;
