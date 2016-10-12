/**
 * Duplicates reference test tables and keep track of matching
 * subfilters and filters
 *
 * @property {Object} subfilters - Link to the subfilters test tables
 * @property {Object} filterIds - Link to the filter Ids test tables
 * @property {Array} matched - matched filters ids
 * @property {Uint8Array} conditions - keep track of matched conditions
 * @property {Uint8Array} filters - keep track of matched filters
  *
 * @param testTablesRef - test tables reference object
 * @param index
 * @param collection
 * @returns {module}
 */
module.exports = function (testTablesRef, index, collection) {
  var self = this;
  this.subfilters = testTablesRef[index][collection].subfilters;
  this.filterIds = testTablesRef[index][collection].filterIds;
  this.conditions = new Uint8Array(testTablesRef[index][collection].conditionsCount);
  this.filters = new Uint8Array(testTablesRef[index][collection].filterIds.length);
  this.matched = [];

  /**
   * Registers a matching subfilters in the test tables
   *
   * @param {string} subfilterId
   */
  this.addMatch = function (subfilterId) {
    var
      refSubfilter = self.subfilters[subfilterId],
      i;

    if (self.conditions[refSubfilter.cidx] > 1) {
      self.conditions[refSubfilter.cidx]--;
    }
    else {
      for(i = 0; i < refSubfilter.fidx.length; i++) {
        if (self.filters[refSubfilter.fidx[i]] === 0) {
          self.filters[refSubfilter.fidx[i]] = 1;
          self.matched.push(self.filterIds[refSubfilter.fidx[i]]);
        }
      }
    }
  };

  /**
   * Like addMatch but with the condition and filter indexes directly
   * provided
   *
   * @param {number} cidx
   * @param {Array} fidx
   */
  this.addMatchIndexes = function (cidx, fidx) {
    var i;

    if (self.conditions[cidx] > 1) {
      self.conditions[cidx]--;
    }
    else {
      for(i = 0; i < fidx.length; i++) {
        if (self.filters[fidx[i]] === 0) {
          self.filters[fidx[i]] = 1;
          self.matched.push(self.filterIds[fidx[i]]);
        }
      }
    }
  };

  return this;
};
