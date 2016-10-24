var
  Transformer = require('./transform'),
  Storage = require('./storage'),
  Matcher = require('./match');

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
   * @return {Array} list of matching rooms
   */
  this.nb = 0;
  this.time = 0;
  this.matches = 0;

  this.test = function (index, collection, data, documentId) {
    var start = Date.now();
    var
      flattened = flattenObject(data, documentId),
      result;

    if (this.exists(index, collection)) {
      result = this.matcher.match(index, collection, flattened);

      var end = Date.now();
      this.time += end - start;
      this.nb++;
      this.matches += result.length;

      if (this.nb%500 === 0) {
        console.log('Stats: ', this.nb, ': ', this.time / this.nb, 'ms (mean)', this.time, 'ms (total) - mean matches: ', this.matches/this.nb);
      }

      return result;
    }

    return [];
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
  var output = {};

  if (id) {
    output._id = id;
  }

  flattenStep(output, target, null, '.');

  return output;
}

function flattenStep(output, object, prev, delimiter) {
  Object.keys(object).forEach(key => {
    var
      value = object[key],
      newKey;

    newKey = prev ? prev + delimiter + key : key;

    if (value && typeof value === 'object'  && !Array.isArray(value)) {
      output[newKey] = value;
      return flattenStep(output, value, newKey, delimiter);
    }

    output[newKey] = value;
  });
}

module.exports = RealtimeEngine;
