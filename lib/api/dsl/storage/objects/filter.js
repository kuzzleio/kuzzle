/**
 * Creates a Filter object referring to a collection of subfilters
 *
 * @param {string} id - filter unique id
 * @param {string} index
 * @param {string} collection
 * @param {Array} [subfilters]
 * @constructor
 */
module.exports = function Filter(id, index, collection, subfilters) {
  this.id = id;
  this.index = index;
  this.collection = collection;

  if (!subfilters) {
    this.subfilters = [];
  }
  else if (Array.isArray(subfilters)) {
    this.subfilters = subfilters;
  }
  else {
    this.subfilters = [subfilters];
  }

  return this;
};
