/**
 * Creates a Subfilter object referring to a collection of filters and conditions
 *
 * @typedef Subfilter
 * @type {Object}
 * @property {string} id
 * @property {Array<Filter>} filters
 * @property {Array<Condition>} conditions
 * @property {Number} cidx - maps to the condition counts test table
 *
 * @param {string} id - subfilter unique id
 * @param {Filter} filter - filter referring to this subfilter
 * @constructor
 */
module.exports = function Subfilter(id, filter) {
  this.id = id;
  this.filters = [filter];
  this.conditions = [];
  this.cidx = -1;

  return this;
};
