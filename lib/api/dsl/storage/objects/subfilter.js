'use strict';

/**
 * Creates a Subfilter object referring to a collection of filters and conditions
 *
 * This allows V8 to convert this object to a pure
 * C++ class, with direct access to its members,
 * instead of a dictionary with b-search access time
 *
 * @typedef Subfilter
 * @type {object}
 * @property {string} id
 * @property {Array<Filter>} filters
 * @property {Array<Condition>} conditions
 * @property {number} cidx - maps to the condition counts test table
 *
 * @param {string} id - subfilter unique id
 * @param {Filter} filter - filter referring to this subfilter
 * @constructor
 */
function Subfilter (id, filter) {
  this.id = id;
  this.filters = [filter];
  this.conditions = [];
  this.cidx = -1;

  return this;
}

module.exports = Subfilter;
