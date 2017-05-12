/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2017 Kuzzle
 * mailto: support AT kuzzle.io
 * website: http://kuzzle.io
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

const
  Transformer = require('./transform'),
  Storage = require('./storage'),
  Matcher = require('./match');

class RealtimeEngine {

  /**
   * @param {Kuzzle} kuzzle
   */
  constructor() {
    this.transformer = new Transformer();
    this.storage = new Storage();
    this.matcher = new Matcher(this.storage);
  }

  /**
   * Checks if the provided filters are valid
   *
   * @param {object} filters
   * @return {Promise<Object>}
   */
  validate(filters) {
    return this.transformer.check(filters);
  }

  /**
   * Subscribes a filter to the real-time engine
   *
   * @param {string} index
   * @param {string} collection
   * @param {object} filters
   * @return {Promise}
   */
  register(index, collection, filters) {
    return this.transformer.normalize(filters)
      .then(normalized => this.storage.store(index, collection, normalized));
  }

  /**
   * Check if there are filters registered on an index-collection pair
   *
   * @param index
   * @param collection
   * @returns {boolean}
   */
  exists(index, collection) {
    return this.storage.filtersIndex[index] !== undefined && this.storage.filtersIndex[index][collection] !== undefined;
  }

  /**
   * Returns all filters IDs registered on an index-collection pair
   *
   * @param index
   * @param collection
   * @returns {Array} Array of matching filter IDs
   */
  getFilterIds(index, collection) {
    return this.exists(index, collection) ? this.storage.filtersIndex[index][collection] : [];
  }

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
  test(index, collection, data, documentId) {
    if (this.exists(index, collection)) {
      return this.matcher.match(index, collection, flattenObject(data, documentId));
    }

    return [];
  }

  /**
   * Removes all references to a given filter from the real-time engine
   *
   * @param {string} filterId - ID of the filter to remove
   * @returns {Promise}
   */
  remove(filterId) {
    return this.storage.remove(filterId);
  }
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
 * @param {object} target the object we have to flatten
 * @param {string} [id] of the document, if relevant
 * @returns {object} the flattened object
 */
function flattenObject(target, id) {
  const output = {};

  if (id) {
    output._id = id;
  }

  flattenStep(output, target, null, '.');

  return output;
}

function flattenStep(output, object, prev, delimiter) {
  Object.keys(object).forEach(key => {
    const
      value = object[key],
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
