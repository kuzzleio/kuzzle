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

class BaseModel {
  constructor (_source, _id) {
    this.__id = null;
    this.__source = {};

    Reflect.defineProperty(this, '__persisted', {
      writable: true,
      value: false
    });

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
        this._source);
    }
  }

  async delete ({ refresh }) {
    if (! this.__persisted) {
      return;
    }

    await BaseModel.indexStorage.delete(
      this.constructor.collection,
      this._id,
      { refresh });
  }

  serialize () {
    return {
      _id : this._id,
      _source: this._source
    };
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
    // Reflect define hidden property for hidding
    // or symbol to keept
    for (const key of Object.keys(_source)) {
      if (this.constructor.fields.includes(key)) {
        this.__source[key] = _source[key] || null;
      }
    }
  }

  // Static public methods =====================================================

  static async load (id) {
    const result = await BaseModel.indexStorage.get(
      this.collection,
      id);

    return this._instantiateFromDb(result);
  }

  static deleteByQuery (searchBody) {
    return BaseModel.indexStorage.deleteByQuery(this.collection, searchBody);
  }

  static async search (searchBody, options) {
    const resp = await BaseModel.indexStorage.search(
      this.collection,
      searchBody,
      options);

    return resp.hits.map(this._instantiateFromDb);
  }

  static truncate () {
    return BaseModel.indexStorage.truncateCollection(this.collection);
  }

  static get collection () {
    throw new Error('Model.collection must be defined');
  }

  static get fields () {
    throw new Error('Model.fields must be defined');
  }

  // Static protected methods ==================================================

  static _instantiateFromDb ({ _id, _source }) {
    const model = new this(_source, _id);

    model.__persisted = true;

    return model;
  }

}

module.exports = BaseModel;