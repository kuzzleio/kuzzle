/**
 * @typedef Condition
 * @type {Object}
 * @property {string} id
 * @property {Array<Subfilter>} subfilters
 * @property {string} keyword
 * @property {Object} value
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

module.exports = Condition;