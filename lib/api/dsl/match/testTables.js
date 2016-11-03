/**
 * Duplicates reference test tables and keep track of matching
 * subfilters and filters
 *
 * /!\ Critical section: benchmark performances
 * before modifying this object.
 * With large number of matching rooms, the "addMatch" method
 * takes a large proportion of the document-matching time.
 * This might be optimizable by converting this object to a C++ class,
 * avoiding the large number of subsequent V8 type testing/casting
 *
 * @property {Array} matched - matched filters ids
 * @property {Uint8Array} conditions - keep track of matched conditions
 * @property {Uint8Array} filters - keep track of matched filters
 *
 * @param testTablesRef - test tables reference object
 * @param index
 * @param collection
 * @constructor
 */
function TestTables (testTablesRef, index, collection) {
  this.conditions = new Uint8Array(testTablesRef[index][collection].conditions);
  this.filters = new Uint8Array(testTablesRef[index][collection].filtersCount);
  this.matched = [];

  return this;
}

/**
 * Registers a matching subfilters in the test tables
 *
 * @param {Array} subfilters - array of matching subfilters
 */
TestTables.prototype.addMatch = function addMatch (subfilters) {
  for(let i = 0; i < subfilters.length; i++) {
    let sf = subfilters[i];

    if (this.conditions[sf.cidx] > 1) {
      this.conditions[sf.cidx]--;
    }
    else {
      for (let j = 0; j < sf.filters.length; j++) {
        let filter = sf.filters[j];

        if (this.filters[filter.fidx] === 0) {
          this.filters[filter.fidx] = 1;
          this.matched.push(filter.id);
        }
      }
    }
  }
};

module.exports = TestTables;
