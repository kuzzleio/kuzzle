'use strict';

const
  crypto = require('crypto'),
  Transformer = require('./transform'),
  Storage = require('./storage'),
  Matcher = require('./match');

/**
 * HashKey is optional: kuzzle instances must provide
 * one, while plugins can instanciate DSL engines
 * each one with its own hash key.
 *
 * @constructor
 * @param {string} [hashKey]
 */
function RealtimeEngine (hashKey) {
  this.hashKey = hashKey || crypto.randomBytes(32);
  this.transformer = new Transformer();
  this.storage = new Storage(this.hashKey);
  this.matcher = new Matcher(this.storage);

  return this;
}

/**
 * Checks if the provided filters are valid
 *
 * @param {object} filters
 * @return {Promise<Object>}
 */
RealtimeEngine.prototype.validate = function validate (filters) {
  return this.transformer.check(filters);
};

/**
 * Subscribes a filter to the real-time engine
 *
 * @param {string} index
 * @param {string} collection
 * @param {object} filters
 * @return {Promise}
 */
RealtimeEngine.prototype.register = function register (index, collection, filters) {
  return this.transformer.normalize(filters)
    .then(normalized => this.storage.store(index, collection, normalized));
};

/**
 * Check if there are filters registered on an index-collection pair
 *
 * @param index
 * @param collection
 * @returns {boolean}
 */
RealtimeEngine.prototype.exists = function exists (index, collection) {
  return this.storage.filtersIndex[index] !== undefined && this.storage.filtersIndex[index][collection] !== undefined;
};

/**
 * Returns all filters IDs registered on an index-collection pair
 *
 * @param index
 * @param collection
 * @returns {Array} Array of matching filter IDs
 */
RealtimeEngine.prototype.getFilterIds = function getFilterIds (index, collection) {
  return this.exists(index, collection) ? this.storage.filtersIndex[index][collection] : [];
};

/**
 * Test data against filters in the filters tree to get the matching
 * filters ID, if any
 *
 * @param {string} index - the index on which the data apply
 * @param {string} collection - the collection on which the data apply
 * @param {object} data to test filters on
 * @param {string} [documentId] - if the data refers to a document, the document unique ID
 * @return {Array} list of matching rooms
 */
RealtimeEngine.prototype.test = function test (index, collection, data, documentId) {
  if (this.exists(index, collection)) {
    return this.matcher.match(index, collection, flattenObject(data, documentId));
  }

  return [];
};

/**
 * Removes all references to a given filter from the real-time engine
 *
 * @param {string} filterId - ID of the filter to remove
 * @returns {Promise}
 */
RealtimeEngine.prototype.remove = function remove (filterId) {
  return this.storage.remove(filterId);
};

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
 * @param {object} target the object we have to flatten
 * @param {string} [id] of the document, if relevant
 * @returns {object} the flattened object
 */
function flattenObject(target, id) {
  let output = {};

  if (id) {
    output._id = id;
  }

  flattenStep(output, target, null, '.');

  return output;
}

function flattenStep(output, object, prev, delimiter) {
  Object.keys(object).forEach(key => {
    let
      value = object[key],
      newKey;

    newKey = prev ? prev + delimiter + key : key;

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      output[newKey] = value;
      return flattenStep(output, value, newKey, delimiter);
    }

    output[newKey] = value;
  });
}

/**
 * @type {RealtimeEngine}
 */
module.exports = RealtimeEngine;
