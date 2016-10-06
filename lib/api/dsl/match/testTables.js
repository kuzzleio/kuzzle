/**
 * Duplicates reference test tables and keep track of matching
 * subfilters and filters
 *
 * @property {Object} reference - Link to the reference test tables
 * @property {number} matched - Number of matched filters
 * @property {Int8Array} conditions - keep track of matched conditions
 * @property {Int8Array} filters - keep track of matched filters
 *
 * @param testTablesRef - test tables reference object
 * @param index
 * @param collection
 * @returns {module}
 */
module.exports = function (testTablesRef, index, collection) {
  var self = this;
  this.reference = testTablesRef[index][collection];
  this.conditions = new Int8Array(testTablesRef[index][collection].conditionsCount);
  this.filters = new Int8Array(testTablesRef[index][collection].filterIds.length);
  this.matched = 0;

  /**
   * Registers a matching subfilters in the test tables
   *
   * @param {string} subfilterId
   */
  this.addMatch = function (subfilterId) {
    var
      refSubfilter = self.reference.subfilters[subfilterId],
      i;

    self.conditions[refSubfilter.cidx]--;

    if (self.conditions[refSubfilter.cidx] === 0) {
      for(i = 0; i < refSubfilter.fidx.length; i++) {
        if (self.filters[refSubfilter.fidx[0]] === 0) {
          self.filters[refSubfilter.fidx[0]] = 1;
          self.matched++;
        }
      }
    }
  };

  return this;
};
