/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2020 Kuzzle
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

const _ = require('lodash');
const { NotFoundError } = require('kuzzle-common-objects');

const Repository = require('../shared/repository');

class PluginRepository extends Repository {
  constructor (kuzzle, pluginIndex, collection) {
    super(kuzzle, pluginIndex);

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
   * @param {object} [options]
   * @returns {Promise}
   */
  create (object, options = {}) {
    const opts = Object.assign({method: 'create'}, options);

    return this.persistToDatabase(object, opts);
  }

  /**
   * @param {object} object
   * @param {object} [options]
   * @returns {Promise}
   */
  createOrReplace (object, options = {}) {
    const opts = Object.assign({method: 'createOrReplace'}, options);

    return this.persistToDatabase(object, opts);
  }

  /**
   * @param {object} object
   * @param {object} [options]
   * @returns {Promise}
   */
  replace (object, options = {}) {
    const opts = Object.assign({method: 'replace'}, options);

    return this.persistToDatabase(object, opts);
  }

  /**
   * @param {object} object
   * @param {object} [options]
   * @returns {Promise}
   */
  update (object, options = {}) {
    const opts = Object.assign({method: 'update'}, options);

    return this.persistToDatabase(object, opts);
  }

  /**
   * If we load a user that does not exists, we have to resolve the promise with null
   * instead of throwing NotFoundError
   *
   * @param {string} documentId
   * @returns {Promise}
   */
  load (documentId) {
    return super.load(documentId)
      .catch(error => {
        if (this.collection === 'users' && (error instanceof NotFoundError)) {
          return Promise.resolve(null);
        }

        throw error;
      });
  }

  /**
   * @param {string} documentId
   * @param {object} [options]
   * @returns {Promise}
   */
  delete (documentId, options = {}) {
    return super.delete({ _id: documentId }, options);
  }
}

module.exports = PluginRepository;
