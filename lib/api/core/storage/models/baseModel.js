/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2018 Kuzzle
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

const Bluebird = require('bluebird');

class BaseModel {
  constructor (_source, _id) {
    this.__id = null;
    this.__source = {};

    Reflect.defineProperty(this, '__persisted', {
      writable: true,
      value: false
    });

    // Define getters and setters for model fields
    for (const field of this.constructor.fields) {
      Reflect.defineProperty(this, field, {
        get: () => this.__source[field],
        set: value => {
          this.__source[field] = value;
        }
      });
    }

    this._id = _id;
    this._source = _source;
  }

  // Public methods ============================================================

  /**
   * Save the current instance in the database.
   *  - use update if the instance already exists
   *  - use create otherwise
   *
   * @param {Object} options - userId (null), refresh (null)
   *
   * @returns {Promise}
   */
  async save ({ userId=null, refresh } = {}) {
    if (! this.__persisted) {
      const { _id, _source } = await BaseModel.indexStorage.create(
        this.constructor.collection,
        this._id,
        this._source,
        { userId, refresh });

      this._id = _id;
      this._source = _source;
    }
    else {
      await BaseModel.indexStorage.update(
        this.constructor.collection,
        this._id,
        this._source,
        { userId, refresh });
    }
  }

  /**
   * Delete the current instance from the database.
   *  - call the _afterDelete hook after deletion
   *
   * @param {Object} options - refresh (null)
   *
   * @returns {Promise}
   */
  async delete ({ refresh } = {}) {
    if (! this.__persisted) {
      return;
    }

    await BaseModel.indexStorage.delete(
      this.constructor.collection,
      this._id,
      { refresh });

    await this._afterDelete();
  }

  /**
   * Returns a plain object representing the instance
   *
   * @returns {Object} { _id, _source }
   */
  serialize () {
    return {
      _id : this._id,
      _source: this._source
    };
  }

  // Protected methods =========================================================

  /**
   * Hook called in the delete method after deletion from the database
   *
   * @returns {Promise}
   */
  async _afterDelete () {
    return null;
  }

  // Getter/Setter =============================================================

  get _id () {
    return this.__id;
  }

  set _id (_id) {
    this.__id = _id;
  }

  get _source () {
    return this.__source;
  }

  set _source (_source) {
    for (const key of Object.keys(_source)) {
      if (this.constructor.fields.includes(key)) {
        this.__source[key] = _source[key] || null;
      }
    }
  }

  // Static public methods =====================================================

  /**
   * Loads an instance from the database
   *
   * @param {String} id
   *
   * @returns {BaseModel}
   */
  static async load (id) {
    const result = await BaseModel.indexStorage.get(
      this.collection,
      id);

    return this._instantiateFromDb(result);
  }

  /**
   * Deletes all instances matching the given query.
   *  - the instance delete method will be called on each occurence
   *
   * @param {Object} query - Query to march (eg: { match_all: {} })
   * @param {Object} options - refresh (null)
   *
   * @returns {Promise}
   */
  static async deleteByQuery (query, { refresh } = {}) {
    const promises = [];

    await BaseModel.indexStorage.batchExecute(
      this.collection,
      query,
      documents => {
        for (const document of documents) {
          const apiKey = this._instantiateFromDb(document);
          promises.push(
            apiKey.delete()
              .catch(error => {
                if (error.status !== 404) {
                  throw error;
                }
              })
          );
        }
      });

    const promise = Bluebird.all(promises);

    if (refresh) {
      await promise;
      return BaseModel.indexStorage.refreshCollection(this.collection);
    }

    return promise;
  }

  /**
   * Returns instances matching the given query
   *
   * @param {Object} searchBody
   * @param {Object} options - from, size, scroll
   *
   * @returns {BaseModel[]} - Array of instances
   */
  static async search (searchBody, options) {
    const resp = await BaseModel.indexStorage.search(
      this.collection,
      searchBody,
      options);

    return resp.hits.map(hit => this._instantiateFromDb(hit));
  }

  /**
   * Deletes all instances of the collection
   *
   * @param {Object} options - refresh (null)
   *
   * @returns {Promise}
   */
  static truncate ({ refresh } = {}) {
    return this.deleteByQuery({ match_all: {} }, { refresh });
  }

  /**
   * Must be overriden by children
   */
  static get collection () {
    throw new Error('Model.collection must be defined');
  }

  /**
   * Must be overriden by children
   */
  static get fields () {
    throw new Error('Model.fields must be defined');
  }

  // Static protected methods ==================================================

  /**
   * Instantiate the model from a document
   *
   * @param {Object} document - { _id, _source }
   *
   * @returns {BaseModel}
   */
  static _instantiateFromDb ({ _id, _source }) {
    const model = new this(_source, _id); // NOSONAR

    model.__persisted = true;

    return model;
  }

}

module.exports = BaseModel;