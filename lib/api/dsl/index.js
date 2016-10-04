var
  Transformer = require('./transform'),
  Storage = require('./storage'),
  Matcher = require('./match'),
  Promise = require('bluebird');

/**
 * @constructor
 */
function RealtimeEngine () {
  this.transformer = new Transformer();
  this.storage = new Storage();
  this.matcher = new Matcher(this.storage);

  /**
   * Subscribes a filter to the real-time engine
   *
   * @param {String} index
   * @param {String} collection
   * @param {Object} filters
   * @return {Promise}
   */
  this.register = function (index, collection, filters) {
    return this.transformer.normalize(filters)
      .then(normalized => this.storage.store(index, collection, normalized));
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
    var injectedId;

    if (documentId) {
      injectedId = Object.assign({}, data);
      injectedId._id = documentId;
    }
    else {
      injectedId = data;
    }

    if (this.exists(index, collection)) {
      return Promise.resolve(this.matcher.match(index, collection, injectedId));
    }

    return Promise.resolve([]);
  };

  /**
   * Removes all references to a given filter from the real-time engine
   *
   * @param filterId - ID of the filter to remove
   * @returns {Promise}
   */
  this.remove = function (filterId) {
    return this.storage.remove(filterId);
  };

  /**
   * Returns all filters IDs registered on an index-collection pair
   *
   * @param index
   * @param collection
   * @returns {Array} Array of matching filter IDs
   */
  this.getFilterIds = function (index, collection) {
    return this.exists(index, collection) ? this.storage.filtersIndex[index][collection]: [];
  };

  /**
   * Check if there are filters registered on an index-collection pair
   *
   * @param index
   * @param collection
   * @returns {boolean}
   */
  this.exists = function (index, collection) {
    return this.storage.filtersIndex[index] && this.storage.filtersIndex[index][collection];
  };
}

module.exports = RealtimeEngine;
