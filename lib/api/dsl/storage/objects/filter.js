'use strict';

/**
 * Creates a Filter object referring to a collection of subfilters
 *
 * This allows V8 to convert this object to a pure
 * C++ class, with direct access to its members,
 * instead of a dictionary with b-search access time
 *
 * @typedef Filter
 * @type {object}
 * @property {string} id
 * @property {string} index
 * @property {string} collection
 * @property {Array<Array<Object>>} filters in their canonical form
 * @property {Array<Subfilter>} subfilters
 * @property {number} fidx - maps to the filters test table
 *
 * @param {string} id - filter unique id
 * @param {string} index
 * @param {string} collection
 * @param {Array<Array<Object>>} filters
 * @constructor
 */
function Filter(id, index, collection, filters) {
  this.id = id;
  this.index = index;
  this.collection = collection;
  this.filters = filters;
  this.subfilters = [];
  this.fidx = -1;

  return this;
}

module.exports = Filter;
