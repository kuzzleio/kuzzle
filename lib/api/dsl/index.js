var
  Filters = require('./filters'),
  NotFoundError = require('kuzzle-common-objects').Errors.notFoundError,
  BadRequestError = require('kuzzle-common-objects').Errors.badRequestError,
  _ = require('lodash'),
  Promise = require('bluebird'),
  stringify = require('json-stable-stringify'),
  crypto = require('crypto');

/**
 * @constructor
 */
function Dsl () {
  this.filters = new Filters();

  /**
   * Subscribe a filter to the DSL
   * Resolves to an object containing the diff resulting from this
   * action, the unique filter ID and the reworked filters
   *
   * @param {String} index
   * @param {String} collection
   * @param {Object} filters
   * @return {Promise}
   */
  this.register = function dslRegister (index, collection, filters) {
    var
      idObject = {index, collection, filters: filters || {}},
      filterId = crypto.createHash('md5').update(stringify(idObject)).digest('hex');

    if (!filters || Object.keys(filters).length === 0) {
      return this.filters.addCollectionSubscription(filterId, index, collection);
    }

    return this.filters.addSubscription(filterId, index, collection, filters);
  };
  
  /**
   * Test data against filters in the filters tree to get the matching
   * filters ID, if any
   *
   * @param {string} index - the index on which the data apply
   * @param {string} collection - the collection on which the data apply
   * @param {Object} data to test filters on
   * @param {string} [documentId] - if the data refers to a document, the document unique ID
   * @returns {Promise} Resolve to an array of filter IDs matching the provided data
   */
  this.test = function dslTest (index, collection, data, documentId) {
    var
      cachedResults = {},
      filters,
      flattenBody = flattenObject(data, documentId);

    if (!index) {
      return Promise.reject(new NotFoundError('The data doesn\'t contain an index'));
    }

    if (!collection) {
      return Promise.reject(new NotFoundError('The data doesn\'t contain a collection'));
    }

    // No filters set for this index : we return an empty list
    if (!this.filters.filtersTree[index] || !this.filters.filtersTree[index][collection]) {
      return Promise.resolve([]);
    }

    filters = 
      this.filters.testFieldFilters(index, collection, flattenBody, cachedResults)
        .concat(this.filters.testGlobalsFilters(index, collection, flattenBody, cachedResults));

    return Promise.resolve(_.uniq(filters));
  };

  /**
   * Removes all references to a given filter from the DSL
   *
   * @param filterId - ID of the filter to remove
   * @returns {Promise}
   */
  this.remove = function dslRemove (filterId) {
    if (typeof filterId !== 'string') {
      return Promise.reject(new BadRequestError(`Expected a filterId, got a ${typeof filterId}`));
    }

    this.filters.removeFilter(filterId);
    return Promise.resolve();
  };

  /**
   * Returns all filters IDs registered on an index-collection pair
   *
   * @param index
   * @param collection
   * @returns {Array} Array of matching filter IDs
   */
  this.getFilterIds = function dslGetFilterIds (index, collection) {
    return this.filters.getFilterIds(index, collection);
  };

  /**
   * Check if there are filters registered on an index-collection pair
   *
   * @param index
   * @param collection
   * @returns {boolean}
   */
  this.exists = function dslExists (index, collection) {
    return this.filters.filtersTree[index] !== undefined && this.filters.filtersTree[index][collection] !== undefined;
  };
}

/**
 * Flatten an object transform:
 * {
 *  title: "kuzzle",
 *  info : {
 *    tag: "news"
 *  }
 * }
 *
 * Into an object like:
 * {
 *  title: "kuzzle",
 *  info.tag: news
 * }
 *
 * @param {Object} target the object we have to flatten
 * @param {string} [id] of the document, if relevant
 * @returns {Object} the flattened object
 */
function flattenObject(target, id) {
  var
    delimiter = '.',
    output = {};

  if (id) {
    output._id = id;
  }

  function step(object, prev) {
    Object.keys(object).forEach(key => {
      var
        value = object[key],
        newKey;

      newKey = prev ? prev + delimiter + key : key;

      if (value && !Array.isArray(value) && typeof value === 'object' && Object.keys(value).length) {
        output[newKey] = value;
        return step(value, newKey);
      }

      output[newKey] = value;
    });
  }

  step(target);

  return output;
}

module.exports = Dsl;
