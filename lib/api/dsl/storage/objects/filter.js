/**
 * Creates a Filter object referring to a collection of subfilters
 *
 * @typedef Filter
 * @type {Object}
 * @property {string} id
 * @property {string} index
 * @property {string} collection
 * @property {Array<Subfilter>} subfilters
 * @property {Number} fidx - maps to the filters test table
 *
 * @param {string} id - filter unique id
 * @param {string} index
 * @param {string} collection
 * @constructor
 */
function Filter(id, index, collection) {
  this.id = id;
  this.index = index;
  this.collection = collection;
  this.subfilters = [];
  this.fidx = -1;

  return this;
}

module.exports = Filter;
