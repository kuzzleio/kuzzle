/**
 * @typedef Condition
 * @type {Object}
 * @property {string} id
 * @property {Array<Subfilter>} subfilters
 * @property {string} keyword
 * @property {Object} value
 *
 * Stores a filter condition.
 *
 * This allows V8 to convert this object to a pure
 * C++ class, with direct access to its members,
 * instead of a dictionary with b-search access time
 *
 * @param {string} id - condition unique id
 * @param {Subfilter} subfilter - subfilter referring to this condition
 * @param {string} keyword - corresponding DSL keyword
 * @param {Object} value - condition value
 * @constructor
 */
function Condition (id, subfilter, keyword, value) {
  this.id = id;
  this.subfilters = [subfilter];
  this.keyword = keyword;
  this.value = value;

  return this;
}

/**
 * @type {Condition}
 */
module.exports = Condition;