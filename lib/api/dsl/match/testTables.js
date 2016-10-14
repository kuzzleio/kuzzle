/**
 * Duplicates reference test tables and keep track of matching
 * subfilters and filters
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
TestTables.prototype.addMatch = function (subfilters) {
  var i, j;

  for(i = 0; i < subfilters.length; i++) {
    if (this.conditions[subfilters[i].cidx] > 1) {
      this.conditions[subfilters[i].cidx]--;
    }
    else {
      for (j = 0; j < subfilters[i].filters.length; j++) {
        if (this.filters[subfilters[i].filters[j].fidx] === 0) {
          this.filters[subfilters[i].filters[j].fidx] = 1;
          this.matched.push(subfilters[i].filters[j].id);
        }
      }
    }
  }
};

module.exports = TestTables;
