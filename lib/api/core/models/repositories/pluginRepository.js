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

const
  _ = require('lodash'),
  Repository = require('./repository');

class PluginRepository extends Repository {
  constructor (kuzzle, pluginName, collection) {
    super(kuzzle, pluginName);

    this.collection = collection;
    this.ObjectConstructor = Object;
  }

  init (options) {
    if (options && typeof options === 'object' && !Array.isArray(options)) {
      options.cacheEngine = null;

      if (options.ObjectConstructor) {
        this.ObjectConstructor = options.ObjectConstructor;
      }
    }

    super.init(options);
  }

  /**
   * Serializes the object before being persisted to database.
   *
   * @param {object} data - The object to serialize
   * @returns {object}
   */
  serializeToDatabase (data) {
    // avoid the data var mutation
    const result = _.merge({}, data);

    delete result._id;

    return result;
  }

  /**
   * @param {object} object
   * @returns {Promise}
   */
  create (object) {
    return this.persistToDatabase(object, {method: 'create'});
  }

  /**
   * @param {object} object
   * @returns {Promise}
   */
  createOrReplace (object) {
    return this.persistToDatabase(object, {method: 'createOrReplace'});
  }

  /**
   * @param {object} object
   * @returns {Promise}
   */
  replace (object) {
    return this.persistToDatabase(object, {method: 'replace'});
  }

  /**
   * @param {object} object
   * @returns {Promise}
   */
  update (object) {
    return this.persistToDatabase(object, {method: 'update'});
  }

  /**
   * @param {string} documentId
   * @returns {Promise}
   */
  load (documentId) {
    return super.load(documentId);
  }

  /**
   * @param {string} documentId
   * @param {object} options
   * @returns {Promise}
   */
  delete (documentId, options = {}) {
    const opts = {};
    if (options.refresh) {
      opts.refresh = options.refresh;
    }
    return super.delete(documentId, opts);
  }
}

module.exports = PluginRepository;
