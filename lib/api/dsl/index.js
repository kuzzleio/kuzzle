var
  Filters = require('./filters'),
  NotFoundError = require('kuzzle-common-objects').Errors.notFoundError,
  BadRequestError = require('kuzzle-common-objects').Errors.badRequestError,
  async = require('async'),
  _ = require('lodash'),
  q = require('q'),
  stringify = require('json-stable-stringify'),
  crypto = require('crypto');

/**
 * @constructor
 */
function Dsl () {
  this.filters = new Filters();

  /**
   * Create an unique filter ID from an user filter.
   * The calculation is predictable, meaning the resulting
   * filter ID will always be the same with identical filters,
   * independently of the terms order.
   *
   * @param index
   * @param collection
   * @param filters
   * @results {string} filter unique ID
   */
  this.createFilterId = function (index, collection, filters) {
    var idObject = {index, collection};

    idObject.filters = filters || {};

    return crypto.createHash('md5').update(stringify(idObject)).digest('hex');
  };

  /**
   * Subscribe a filter to the DSL
   *
   * @param {String} filterId
   * @param {String} index
   * @param {String} collection
   * @param {Object} filters
   * @return {promise}
   */
  this.register = function (filterId, index, collection, filters) {
    if (!filters || _.isEmpty(filters)) {
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
  this.test = function (index, collection, data, documentId) {
    var
      deferred = q.defer(),
      cachedResults = {},
      flattenBody = flattenObject(data, documentId);

    if (!index) {
      deferred.reject(new NotFoundError('The data doesn\'t contain an index'));
      return deferred.promise;
    }

    if (!collection) {
      deferred.reject(new NotFoundError('The data doesn\'t contain a collection'));
      return deferred.promise;
    }

    // No filters set for this index : we return an empty list
    if (!this.filters.filtersTree[index] || !this.filters.filtersTree[index][collection]) {
      deferred.resolve([]);
      return deferred.promise;
    }

    async.parallel({
      // Will try filters on field in document
      onFields: callback => {
        this.filters.testFieldFilters(index, collection, flattenBody, cachedResults).nodeify(callback);
      },
      // Will try global filters and add rooms which subscribed on the whole collection
      onGlobals: callback => {
        this.filters.testGlobalsFilters(index, collection, flattenBody, cachedResults).nodeify(callback);
      }
    }, (error, filters) => {
      if (error) {
        return deferred.reject(error);
      }

      deferred.resolve(_.uniq(filters.onFields.concat(filters.onGlobals)));
    });

    return deferred.promise;
  };

  /**
   * Removes all references to a given filter from the DSL
   *
   * @param filterId - ID of the filter to remove
   * @returns {Promise}
   */
  this.remove = function (filterId) {
    var
      deferred = q.defer();

    if (typeof filterId !== 'string') {
      deferred.reject(new BadRequestError(`Expected a filterId, got a ${typeof filterId}`));
      return deferred.promise;
    }

    // Deletes a filter subscription from the DSL
    async.parallel([
      callback => {
        this.filters.removeGlobalFilter(filterId);
        callback();
      },
      callback => {
        this.filters.removeFieldFilter(filterId).nodeify(callback);
      }
    ], deferred.makeNodeResolver());

    return deferred.promise;
  };

  /**
   * Returns all filters IDs registered on an index-collection pair
   *
   * @param index
   * @param collection
   * @returns {Array} Array of matching filter IDs
   */
  this.getFilterIds = function (index, collection) {
    return this.filters.getFilterIds(index, collection);
  };

  /**
   * Check if there are filters registered on an index-collection pair
   *
   * @param index
   * @param collection
   * @returns {boolean}
   */
  this.exists = function (index, collection) {
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
    Object.keys(object).forEach(function(key) {
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
